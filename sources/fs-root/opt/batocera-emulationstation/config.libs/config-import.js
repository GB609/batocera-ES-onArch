const fs = require('node:fs');
const io = require('./logger.js').get()
const { dirname, extname, relative } = require('node:path');

//const { ROMS_DIR_TAG } = require('./path-utils.js');
const { mergeObjects, deepImplode, HierarchicKey, tokenize } = require('./data-utils.js');
const { parseDict, SUPPORTED_TYPES, XML, PropValue } = require('./parsing.js');
const writer = require('./output-formats.js');

const CONFIG_ROOT = envOrVarAbsPath("CONFIG_ROOT", FS_ROOT + '/etc');
const BTC_CONFIG_ROOT = fs.realpathSync(CONFIG_ROOT + '/batocera-emulationstation');
const BTC_BIN_DIR = envOrVarAbsPath("BTC_BIN_DIR", FS_ROOT + "/opt/batocera-emulationstation/bin");
const INBUILD_CONFIG_PATH = fs.realpathSync(BTC_BIN_DIR + "/../conf.d");
const DROPIN_PATH = envOrVarAbsPath("DROPIN_PATH", BTC_CONFIG_ROOT + "/conf.d")

function generateGlobalConfig(options, cfgRoot = BTC_CONFIG_ROOT, btcSysDir = BTC_BIN_DIR, dropinPath = DROPIN_PATH) {
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

/**
 * Simple merge of several property files. Merges them in the order given in `files[]`.  
 * Known options:
 * - `ignoreInvalid`: [true|false] - Whether files that don't exists should be ignored or not
 * - `preMergeAction`: [function] - Allows for transformation of a parsed file's content before merging.
 *     Called once per file, with the file's root object as argument. Expected to return (transformed) object.
 */
function mergePropertyFiles(files, options = {}) {
  let properties = {};
  options = Object.assign({ ignoreInvalid: true }, options);
  let preMerge = options.preMergeAction || (d => d);
  for (confFile of files) {
    if (!fs.existsSync(confFile)) {
      if (options.ignoreInvalid === true) {
        io.debug('skip missing file', confFile);
        continue
      }
      else { throw confFile + ' does not exist!' }
    }
    let confDict = parseDict(confFile);
    mergeObjects(properties, preMerge(confDict));
  }

  return properties;
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
    if (typeof baseConfig[key] == "undefined") { result[key] = dropin }
    else { result[key] = mergeObjects(baseConfig[key], dropin, true) }
  }

  return {
    merged: result,
    sourceFiles: validConfigFiles
  };
}

function generateBtcConfigFiles(properties, targetDir = BTC_CONFIG_ROOT, options) {
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

const BTC_TO_SDL = {
  b: 'a', a: 'b', x: 'y', y: 'x',
  l2: 'lefttrigger', r2: 'righttrigger',
  l3: 'leftstick', r3: 'rightstick',
  pageup: 'leftshoulder', pagedown: 'rightshoulder',
  start: 'start', select: 'back',
  up: 'dpup', down: 'dpdown', left: 'dpleft', right: 'dpright',
  joystick1up: 'lefty', joystick1left: 'leftx',
  joystick2up: 'righty', joystick2left: 'rightx',
  hotkey: 'guide'
}
function sign(num) { return num < 0 ? '-' : '+' }
function sdlForBtc(btcName) { return BTC_TO_SDL[btcName] || '' }
/** sort entries of buttonDef[] to the iteration order of BTC_TO_SDL to make comparison easier */
function sortDefinitions(buttonDefs) {
  let keys = Object.keys(BTC_TO_SDL);
  let real = buttonDefs.reduce((all, cur) => {
    return all[cur.name] = cur, all;
  }, {});
  return keys
    .map(k => real[k] || null)
    .filter(_ => _ != null)
}
const BUTTON_PATTERN = /(\w+):b(\d+)/
let CURRENT_INPUT_FILE;

class ControllerConfig {
  static readControllerSDL(customFiles, controllerIds = null) {
    const internalConfig = `${BTC_BIN_DIR}/es_input.cfg`;
    const userConfig = `${getConfigHome()}/es_input.cfg`;
    if (controllerIds == null) {
      controllerIds = customFiles;
      customFiles = [internalConfig, userConfig]
    }
    if (!Array.isArray(customFiles)) { customFiles = [customFiles] }
    let filterRegex = Object.keys(controllerIds.reduce(
      (total, current) => {
        tokenize(current, ':', 2).forEach(found => total[RegExp.escape(found.trim())] = true);
        return total;
      }, {}
    )).join('|') || '.*';
    filterRegex = new RegExp(filterRegex);

    let merged = {}
    for (let file of customFiles) {
      if (!fs.existsSync(file)) { continue }
      CURRENT_INPUT_FILE = file;

      let rawInputXml = fs.readFileSync(file, { encoding: 'utf8' });

      rawInputXml
        .split(/<inputConfig|<\/inputConfig>/)
        .filter(entry => filterRegex.test(entry))
        .map(ControllerConfig.fromXml)
        .reduce((all, cur) => {
          let guid = cur.valueOf().guid;
          all[guid] = cur;
          return all
        }, merged);
    }

    return Object.values(merged);
  }

  static fromXml(rawXml) {
    let xmlLines = rawXml
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    let header = ControllerConfig.propertyObjectFromLine(xmlLines.shift());
    xmlLines = xmlLines.map(line => { return ControllerConfig.propertyObjectFromLine(line) });
    return new PropValue(new ControllerConfig(header, xmlLines), CURRENT_INPUT_FILE);
  }

  static propertyObjectFromLine(xmlLine = "") {
    io.debug("trying to parse line: ", xmlLine)
    return xmlLine.match(/\w+=".*?"/g)
      .map(_ => tokenize(_, '=', 2))
      .reduce((all, cur) => {
        let v = cur[1];
        all[cur[0]] = XML.decodeValue(v.substring(1, v.length - 1));
        return all;
      }, {})
  }

  static header(def) { return `${def.deviceGUID},${def.deviceName.replace(',', '.')},platform:Linux` }

  /* Conversions form btc es_input config syntax to SDL.
  * See [_key_to_sdl_game_controller_config](https://github.com/batocera-linux/batocera.linux/blob/master/package/batocera/core/batocera-configgen/configgen/configgen/controller.py)
  */
  static button(def) { return `${sdlForBtc(def.name)}:b${def.id}` }
  static axis(def) {
    let key = sdlForBtc(def.name);
    if (def.name.includes('joystick')) { `f{key}:a${def.id}${def.value > 0 ? '~' : ''}` }
    if (key.startsWith('dp')) { return `${key}:${sign(def.value)}a${def.id}` }
    if (key.includes('trigger')) { `f{key}:a${def.id}${def.value < 0 ? '~' : ''}` }
    return `${key}:a${def.id}`;
  }
  static hat(def) { return `${sdlForBtc(def.name)}:h${def.id}.${def.value}` }

  constructor(headerProps, buttonDefs = []) {
    this.guid = headerProps.deviceGUID;
    this.header = ControllerConfig.header(headerProps);
    // use central register to prevent double assignment of simple buttons
    let usedButtons = [];
    this.mapping = sortDefinitions(buttonDefs)
      .map(l => { io.debug("Map button: ", l); return l })
      .map(def => {
        let btnDef = (ControllerConfig[def.type] || (() => null))(def);
        if (BUTTON_PATTERN.test(btnDef)) {
          let buttonIndex = BUTTON_PATTERN.exec(btnDef)[2];
          if (usedButtons.includes(buttonIndex)) { return null }
          usedButtons.push(buttonIndex);
        }
        return btnDef;
      })
      .filter(_ => _ != null);
  }

  /** Generates an SDL string */
  toString() {
    return [
      this.header,
      ...this.mapping
    ].join(',')
  }
}

module.exports = {
  CONFIG_ROOT, BTC_CONFIG_ROOT, DROPIN_PATH, BTC_BIN_DIR,
  generateGlobalConfig,
  mergePropertyFiles,
  mergeDropinsToInbuild,
  generateBtcConfigFiles,
  readControllerSDL: ControllerConfig.readControllerSDL
}
