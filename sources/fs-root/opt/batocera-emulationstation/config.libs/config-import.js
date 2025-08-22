const fs = require('node:fs');
const io = require('./logger.js').get()
const { dirname, extname, relative, resolve } = require('node:path');

//const { ROMS_DIR_TAG } = require('./path-utils.js');
const { mergeObjects, deepImplode, HierarchicKey } = require('./data-utils.js');
const { parseDict, SUPPORTED_TYPES } = require('./parsing.js');
const writer = require('./output-formats.js');

const CONFIG_ROOT = envOrVarAbsPath("CONFIG_ROOT", FS_ROOT + "/etc/batocera-emulationstation");
const BTC_BIN_DIR = envOrVarAbsPath("BTC_BIN_DIR", FS_ROOT + "/opt/batocera-emulationstation/bin");
const INBUILD_CONFIG_PATH = fs.realpathSync(BTC_BIN_DIR + "/../conf.d");
const DROPIN_PATH = envOrVarAbsPath("DROPIN_PATH", CONFIG_ROOT + "/conf.d")

function generateGlobalConfig(options, cfgRoot = CONFIG_ROOT, btcSysDir = BTC_BIN_DIR, dropinPath = DROPIN_PATH) {
  io.userOnly('Generating (etc and/or application internal) config files for batocera-emulationstation', {
    inbuildConfigDir: INBUILD_CONFIG_PATH,
    dropinDir: isValidPath(dropinPath) ? dropinPath : 'No valid dropin directory given',
    osConfigDir: isValidPath(cfgRoot) ? cfgRoot : 'No config directory given, skip property file creation',
    emulationStationBinPath: isValidPath(btcSysDir) ? btcSysDir : 'No packge binPath given, skip creation of es_systems.yml and es_features.yml'
  });

  let summaryFilesDir = '.';
  if (isValidPath(cfgRoot)) { summaryFilesDir = cfgRoot }
  else if (isValidPath(dropinPath)) { summaryFilesDir = dropinPath + '/..' }

  let dropinTarget;
  if (isValidPath(btcSysDir)) {
    dropinTarget = dropinPath + "/systems";
    let systems = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_systems.yml", dropinTarget);
    writer.systems.write(systems.merged, btcSysDir + "/es_systems.cfg", {
      romDir: ROMS_DIR_TAG,
      comment: buildComment(systems, options, dropinTarget),
      createRootKeysDictFile: summaryFilesDir + '/supported_systems.json',
      verbose: options['-v'] || false
    });

    dropinTarget = dropinPath + "/features";
    let features = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_features.yml", dropinTarget);
    writer.features.write(features.merged, btcSysDir + "/es_features.cfg", {
      comment: buildComment(features, options, dropinTarget),
      createRootKeysDictFile: summaryFilesDir + '/supported_emulators.json',
      verbose: options['-v'] || false
    });
  }

  /*
   * Merging properties is more complicated, because any user changes in the generated conf files in must be included as well.
   * Moreover they are split into multiple files in several places
   * 1. Base: batocera.conf, configgen-defaults.yml, configgen-defaults-x86_64.yml
   * 2. User properties: batocera.conf, emulators.conf
   */
  if (isValidPath(cfgRoot)) {
    dropinTarget = dropinPath + "/properties";
    let properties = mergeDropinsToInbuild([
      INBUILD_CONFIG_PATH + "/batocera.conf",
      INBUILD_CONFIG_PATH + "/configgen-defaults.yml",
      INBUILD_CONFIG_PATH + "/configgen-defaults-x86_64.yml"
    ], [
      summaryFilesDir + "/supported_systems.json",
      dropinTarget
    ]);
    generateBtcConfigFiles(properties.merged, cfgRoot, {
      comment: buildComment(properties, options, dropinTarget),
      verbose: options['-v'] || false
    });
  }
}

function buildComment(mergeResult, options, dropinDir) {
  let defaultCommentBase = [
    "generated from btc-config generateGlobalConfig",
    "Any manual change to this file will be lost on pacman updates to any [batocera-es-...] package",
    `Use a drop-in file in ${dropinDir} for persistent changes`
  ];
  let sourceList = `\nsources:\n${mergeResult.sourceFiles.map(_ => '/' + relative(FS_ROOT, _)).join('\n')}`;
  return (options['--comment'] || defaultCommentBase.join('\n')) + sourceList;
}

function mergeDropinsToInbuild(base, dropinDir) {
  if (!Array.isArray(dropinDir)) { dropinDir = [dropinDir] }
  let validConfigFiles = dropinDir
    .filter(fs.existsSync)
    .flatMap(_ => {
      let stat = fs.statSync(_);
      if (stat.isDirectory()) {
        return fs.readdirSync(_, { withFileTypes: true })
          .filter(f => f.isFile() || f.isLink())
          .map(f => f.name).sort()
          .map(f => `${_}/${f}`);
      }
      return _;
    })
    .filter(_ => SUPPORTED_TYPES.includes(extname(_)));

  let firstDropin = null;
  let mergedDropins = {};
  validConfigFiles.forEach(confFile => {
    let currentDict = parseDict(confFile);
    //remember the first dropin we find, it will be the file '00-supported-...'
    firstDropin = firstDropin || currentDict;
    mergeObjects(mergedDropins, currentDict, true);
  });

  if (!Array.isArray(base)) { base = [base] }
  let baseConfig = {};
  base.forEach(baseFile => {
    if (!fs.existsSync(baseFile)) { return }
    validConfigFiles.splice(base.indexOf(baseFile), 0, baseFile);
    mergeObjects(baseConfig, parseDict(baseFile), true)
  });

  //apply the first dropin to baseConfig directly.
  //this might seem redundant, but is the least complicated way to apply deletions by setting properties to null
  //with that it becomes possible to "empty" an array and start anew.
  mergeObjects(baseConfig, firstDropin || {}, true)
  
  //drop top-level keys not mentioned in any dropin
  //with that we have a mixed approach to remove surplus/unsupported properties from batocera
  // - subkeys of supported paths by setting the corresponding property to null
  // - dropping entire top-level trees by not mentioning them in any of the dropins
  let result = {};
  for (let [key, dropin] of Object.entries(mergedDropins)) {
    if(typeof baseConfig[key] == "undefined") { result[key] = dropin }
    else { result[key] = mergeObjects(baseConfig[key], dropin, true) }
  }

  return {
    merged: result,
    sourceFiles: validConfigFiles
  };
}

function generateBtcConfigFiles(properties, targetDir = CONFIG_ROOT, options) {
  [...Object.values(properties)].forEach(value => {
    //flatten out first level property name 'options'
    if (typeof value.options != "undefined") {
      let options = value.options;
      Object.assign(value, value.options);
      //delete value.options if it still points to the same as before.
      //if not, it means that there was a second-level .options subdict,
      //so: system.options.options before flattening
      if (Object.is(options, value.options)) { delete value.options }
    }
  });

  let imploded = deepImplode(properties);
  let byTargetFile = {};
  for (let [key, value] of Object.entries(imploded)) {
    let parsed = API.btcPropDetails(key, value);
    if (!parsed) { continue }

    //'core' is useless for most basic emulators, especially when it just is identical
    //drop this duplication after everything has been merged
    if (parsed.effectiveKey.last() == "core") {
      let emu = HierarchicKey.from(parsed.effectiveKey.parent(), 'emulator');
      if (emu.get(properties, null) == String(parsed.value)) { continue }
    }

    let targetObj = byTargetFile[parsed.file] ||= {};
    parsed.effectiveKey.set(targetObj, value);
  }

  let commentLines = ""
  if (options.comment) {
    commentLines = '# ' + options.comment.replaceAll('\n', '\n# ');
  }

  for (let [filename, props] of Object.entries(byTargetFile)) {
    let numLines = Object.keys(props).length;
    if (numLines > 0) {
      io.info(`writing file ${filename} with ${numLines} lines`);
      let finalFilePath = targetDir + '/' + filename;

      fs.mkdirSync(dirname(finalFilePath), { recursive: true })
      writer.conf.write(props, finalFilePath, { comment: commentLines, verbose: options.verbose });
    }
  }
}

function readControllerSDL(controllerIds){
  //1. read file: binDir/es_input.cfg, userconfig/es_input.cfg
  //2. split by <inputConfig|</inputConfig>
  //forEach: filter by id/name
  //if match, split further and transform
}

module.exports = {
  CONFIG_ROOT, DROPIN_PATH, BTC_BIN_DIR,
  generateGlobalConfig,
  mergeDropinsToInbuild,
  generateBtcConfigFiles,
  readControllerSDL
}
