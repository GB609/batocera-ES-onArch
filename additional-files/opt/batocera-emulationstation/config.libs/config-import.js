const fs = require('node:fs');
const { extname } = require('node:path');

const { mergeObjects, deepImplode, HierarchicKey } = require('./data-utils.js');
const { parseDict, SUPPORTED_TYPES } = require('./parsing.js');
const writer = require('./output-formats.js');

const INBUILD_CONFIG_PATH = FS_ROOT + "/opt/batocera-emulationstation/conf.d"
const CONFIG_ROOT = FS_ROOT + "/etc/batocera-emulationstation";
const BTC_BIN_DIR = FS_ROOT + "/opt/batocera-emulationstation/bin"
const DROPIN_PATH = CONFIG_ROOT + "/conf.d"

function generateGlobalConfig(options, propTargetDir = CONFIG_ROOT, btcSysDir = BTC_BIN_DIR) {
  if (btcSysDir != null) {
    let systems = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_systems.yml", DROPIN_PATH + "/systems");
    writer.systems.write(systems.result, btcSysDir + "/es_systems.cfg", {
      romDir: ROMS_DIR_TAG,
      comment: buildComment(systems, options['--comment'])
    });


    let features = mergeDropinsToInbuild(INBUILD_CONFIG_PATH + "/es_features.yml", DROPIN_PATH + "/features");
    writer.features.write(features.merged, btcSysDir + "/es_features.cfg", {
      comment: buildComment(features, options['--comment'])
    });
  }

  /*
   * Merging properties is more complicated, because any user changes in the generated conf files in must be included as well.
   * Moreover they are split into multiple files in several places
   * 1. Base: batocera.conf, configgen-defaults.yml, configgen-defaults-x86_64.yml
   * 2. User properties: batocera.conf, emulators.conf
   */
  if (propTargetDir != null) {
    let properties = mergeDropinsToInbuild([
      INBUILD_CONFIG_PATH + "/batocera.conf",
      INBUILD_CONFIG_PATH + "/configgen-defaults.yml",
      INBUILD_CONFIG_PATH + "/configgen-defaults-x86_64.yml"
    ], [
      DROPIN_PATH + "/properties",
      CONFIG_ROOT + "/batocera.conf",
      CONFIG_ROOT + "/emulators.conf"
    ]);
    generateBtcConfigFiled(properties.merged, propTargetDir, {
      comment: buildComment(properties, options['--comment'])
    });
  }
}

function buildComment(mergeResult, options) {
  let defaultCommentBase = "generated from btc-config generateGlobalConfig";
  let sourceList = `\nsources:\n${mergeResult.sourceFiles.join('\n')}`;
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
    mergeObjects(baseConfig, parseDict(baseFile), true)
  });

  let result = {};
  for (let [key, dropin] of Object.entries(mergedDropins)) {
    result[key] = mergeObjects(baseConfig[key] || {}, dropin);
  }

  return {
    merged: result,
    sourceFiles: validConfigFiles
  };
}

function generateBtcConfigFiled(properties, targetDir = CONFIG_ROOT, options) {
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
      if (imploded[emu] == parsed.value) { continue }
    }

    let targetObj = byTargetFile[parsed.file] ||= {};
    targetObj[key] = value;
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

      fs.mkdirSync(path.dirname(finalFilePath), { recursive: true })
      writer.conf.write(props, finalFilePath, { comment: commentLines });
    }
  }
}

module.exports = {
  DROPIN_PATH,
  generateGlobalConfig,
  mergeDropinsToInbuild,
  generateBtcConfigFiled
}
