const fs = require('node:fs');
const { dirname, extname, relative, resolve } = require('node:path');

//const { ROMS_DIR_TAG } = require('./path-utils.js');
const { mergeObjects, deepImplode, HierarchicKey } = require('./data-utils.js');
const { parseDict, SUPPORTED_TYPES } = require('./parsing.js');
const writer = require('./output-formats.js');

const INBUILD_CONFIG_PATH = FS_ROOT + "/opt/batocera-emulationstation/conf.d"
const CONFIG_ROOT = FS_ROOT + "/etc/batocera-emulationstation";
const BTC_BIN_DIR = FS_ROOT + "/opt/batocera-emulationstation/bin"
const DROPIN_PATH = CONFIG_ROOT + "/conf.d"

function generateGlobalConfig(options, cfgRoot = CONFIG_ROOT, btcSysDir = BTC_BIN_DIR, dropinPath = DROPIN_PATH) {
  console.debug('Generating (etc and/or application internal) config files for batocera-emulationstation', {
    inbuildConfigDir: INBUILD_CONFIG_PATH,
    dropinDir: isValidPath(dropinPath) ? dropinPath : 'No valid dropin directory given',
    osConfigDir: isValidPath(cfgRoot) ? cfgRoot : 'No config directory given, skip property file creation',
    emulationStationBinPath: isValidPath(btcSysDir) ? btcSysDir : 'No packge binPath given, skip creation of es_systems.yml and es_features.yml'
  });

  let summaryFilesDir = '.';
  if (isValidPath(cfgRoot)) { summaryFilesDir = cfgRoot }
  else if (isValidPath(dropinPath)) { summaryFilesDir = dropinPath + '/..' }

  if (isValidPath(btcSysDir)) {
    let systems = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_systems.yml", dropinPath + "/systems");
    writer.systems.write(systems.merged, btcSysDir + "/es_systems.cfg", {
      romDir: ROMS_DIR_TAG,
      comment: buildComment(systems, options),
      createRootKeysDictFile: summaryFilesDir + '/supported_systems.json'
    });

    let features = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_features.yml", dropinPath + "/features");
    writer.features.write(features.merged, btcSysDir + "/es_features.cfg", {
      comment: buildComment(features, options),
      createRootKeysDictFile: summaryFilesDir + '/supported_emulators.json'
    });
  }

  /*
   * Merging properties is more complicated, because any user changes in the generated conf files in must be included as well.
   * Moreover they are split into multiple files in several places
   * 1. Base: batocera.conf, configgen-defaults.yml, configgen-defaults-x86_64.yml
   * 2. User properties: batocera.conf, emulators.conf
   */
  if (isValidPath(cfgRoot)) {
    let properties = mergeDropinsToInbuild([
      INBUILD_CONFIG_PATH + "/batocera.conf",
      INBUILD_CONFIG_PATH + "/configgen-defaults.yml",
      INBUILD_CONFIG_PATH + "/configgen-defaults-x86_64.yml"
    ], [
      summaryFilesDir + "/supported_systems.json",
      dropinPath + "/properties",
      cfgRoot + "/batocera.conf",
      cfgRoot + "/emulators.conf"
    ]);
    generateBtcConfigFiles(properties.merged, cfgRoot, {
      comment: buildComment(properties, options)
    });
  }
}

function buildComment(mergeResult, options) {
  let defaultCommentBase = "generated from btc-config generateGlobalConfig";
  let sourceList = `\nsources:\n${mergeResult.sourceFiles.map(_ => '/' + relative(FS_ROOT, _)).join('\n')}`;
  return (options['--comment'] || defaultCommentBase) + sourceList;
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

  let mergedDropins = {};
  validConfigFiles.forEach(confFile => {
    let currentDict = parseDict(confFile);
    mergeObjects(mergedDropins, currentDict, true);
  });

  if (!Array.isArray(base)) { base = [base] }
  let baseConfig = {};
  base.forEach(baseFile => {
    if (!fs.existsSync(baseFile)) { return }
    validConfigFiles.push(baseFile);
    mergeObjects(baseConfig, parseDict(baseFile), true)
  });

  let result = {};
  for (let [key, dropin] of Object.entries(mergedDropins)) {
    result[key] = mergeObjects(baseConfig[key] || {}, dropin, true);
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
  //console.debug(imploded)
  let byTargetFile = {};
  for (let [key, value] of Object.entries(imploded)) {
    let parsed = API.btcPropDetails(key, value);
    if (!parsed) { continue }

    //'core' is useless for most basic emulators, especially when it just is identical
    //drop this duplication after everything has been merged
    if (parsed.effectiveKey.last() == "core") {
      let emu = HierarchicKey.from(parsed.effectiveKey.parent(), 'emulator');
      console.debug('checking emu/core', parsed, emu, emu.get(properties, null))

      if (emu.get(properties, null) == String(parsed.value)) { continue }
    }

    let targetObj = byTargetFile[parsed.file] ||= {};
    //console.debug("assignment:", key, value)
    parsed.effectiveKey.set(targetObj, value);
  }

  let commentLines = ""
  if (options.comment) {
    commentLines = '# ' + options.comment.replaceAll('\n', '\n# ');
  }

  for (let [filename, props] of Object.entries(byTargetFile)) {
    let numLines = Object.keys(props).length;
    if (numLines > 0) {
      console.log(`writing file ${filename} with ${numLines} lines`);
      let finalFilePath = targetDir + '/' + filename;

      fs.mkdirSync(dirname(finalFilePath), { recursive: true })
      writer.conf.write(props, finalFilePath, { comment: commentLines });
    }
  }
}

module.exports = {
  DROPIN_PATH, BTC_BIN_DIR,
  generateGlobalConfig,
  mergeDropinsToInbuild,
  generateBtcConfigFiles
}
