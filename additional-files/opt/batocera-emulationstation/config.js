#!/usr/bin/node

const api = require("./config.libs/cmdline-api.js");
const data = require('./config.libs/data-utils.js');
const fs = require('node:fs');

Object.assign(globalThis, require('./config.libs/path-utils.js'));
const API = {};

const FS_ROOT = process.env['FS_ROOT'] || fs.realpathSync(__dirname + "/../..");
const UNSUPPORTED_KEYS = ['kodi', 'led', 'splash', 'updates', 'wifi2', 'wifi3']
const SUPPORTED_PROPERTIES = require('./conf.d/supported_configs.json');
const SUPPORTED_SYSTEMS = require('./conf.d/supported_systems.json');
const SUPPORTED_EMULATORS = require('./conf.d/supported_emulators.json');
const { getConfigHome } = require("./config.libs/path-utils.js");

API.btcPropDetails = function(propLine, value) {
  if (typeof value != "undefined") { propLine = `${propLine}=${value}` }
  let { analyseProperty } = require('./config.libs/parsing.js');

  let analysedProp = analyseProperty(propLine);
  let file = "system.conf";
  if (SUPPORTED_SYSTEMS.includes(analysedProp.effectiveKey[0])) {
    file = "emulators.conf";
  }

  return Object.assign(analysedProp, { file: file });
}

API.generate = api.action(
  { '--romdir': 1, '--as-override': 1, '--attributes': 'csv', '--comment': 1 },
  (options, type, sourceFile, targetDir) => {
    let parser = require('./config.libs/parsing.js');
    let data = parser.yamlToDict(sourceFile);

    let targetFile;
    if (typeof targetDir == "undefined") { targetFile = process.stdout }
    if (options['--attributes'].length == 0) { delete options['--attributes'] }

    let comment = options['--comment'] || 'Generated from ' + sourceFile;

    let output = require('./config.libs/output-formats.js');
    switch (type) {
      case "systems":
        let appendix = options['--as-override'] ? '-' + options['--as-override'] : '';
        targetFile ||= targetDir + `/es_systems${appendix}.cfg`;
        output.systems.write(data, targetFile, {
          filter: k => SUPPORTED_SYSTEMS.includes(k),
          romDir: options['--romdir'] || process.env['ROMS_ROOT_DIR'] || "~/ROMs",
          attributes: options['--attributes'],
          launchCommand: "emulatorlauncher %CONTROLLERSCONFIG% -system %SYSTEM% -rom %ROM% -gameinfoxml %GAMEINFOXML% -systemname %SYSTEMNAME%",
          comment: comment
        });
        break;
      case "features":
        targetFile ||= targetDir + "/es_features.cfg";
        output.features.write(data, targetFile, {
          filter: k => SUPPORTED_EMULATORS.includes(k),
          comment: comment
        });
        break;
    }
  })

API.effectiveProperties = api.action(
  {
    '*--format': ['sh', 'json', 'conf', 'yml'],
    '--include-source' : 0,
    '--strip-prefix': /\d+/,
    '--declare-fn': 1,
    '--system': 1
  }, (options, relativeRomPath) => {
    let propertyFiles = [];
    console.debug("options are:", options)

    let romInfo = romInfoFromPath(relativeRomPath, options['--system']);
    console.log("found romInfo", romInfo)
    propertyFiles.push(
      `${FS_ROOT}/etc/batocera-emulationstation/emulators.conf`,
      romInfo.systemPath + '/folder.conf');
    romInfo.subfolders.reduce((appended, current) => {
      return propertyFiles.push(`${appended += '/' + current}/folder.conf`), appended;
    }, romInfo.systemPath);
    propertyFiles.push(
      `${romInfo.absPath}/folder.conf`, `${romInfo.absPath}.conf`/*,
TODO: cfg file parser for es_settings.cfg/xml      getConfigHome() + '/es_settings.cfg'*/
    );

    let merged = mergePropertyFiles(propertyFiles);
    if(typeof merged[romInfo.system] == "undefined"){
      throw new Error(`System ${romInfo.system} is not supported - no properties found.`)
    }
    
    _unwrapSpecificSubdict(merged[romInfo.system], 'folder', romInfo.subfolders.join('/'));
    _unwrapSpecificSubdict(merged[romInfo.system], 'game', romInfo.game);

    //now merge and pick all properties from default and system, folder and game have been merged into system already
    let effectiveResult = { [romInfo.system]: {} };
    let systemProps = effectiveResult[romInfo.system];
    Object.assign(systemProps, merged['default'] || {});
    data.mergeObjects(systemProps, merged['global'] || {});
    data.mergeObjects(systemProps, merged[romInfo.system] || {});

    let writer = require('./config.libs/output-formats.js');
    writer[options['--format']].write(effectiveResult, process.stdout, {
      declareCommand: options['--declare-fn'],
      stripPrefix: options['--strip-prefix'],
      printSource: options['--include-source']
    });
  });

function _unwrapSpecificSubdict(container, subdictContainerKey, subdictKey) {
  let subdict = container[subdictContainerKey] || {}
  data.mergeObjects(container, subdict[subdictKey] || {});
  delete container[subdictContainerKey];
}

function mergePropertyFiles(files, options = {}) {
  let parser = require('./config.libs/parsing.js');
  let properties = {};
  options = Object.assign({ ignoreInvalid: true }, options);
  let preMerge = options.preMergeAction || (d => d);
  for (confFile of files) {
    if (!fs.existsSync(confFile)) {
      if (options.ignoreInvalid === true) {
        console.debug('skip missing file', confFile);
        continue
      }
      else { throw confFile + ' does not exist!' }
    }
    let confDict = parser.parseDict(confFile);
    data.mergeObjects(properties, preMerge(confDict));
  }

  return properties;
}

API.importBatoceraConfig = api.action({ '-o': 1, '--comment': 1 }, (options, ...files) => {
  let cfgImport = ('./config.libs/config-import.js');
  let { basename } = require('node:path');

  let targetDir = options["-o"];

  //symlink target -> path
  let i = 0;
  let prefix = cfgImport.DROPIN_PATH + '/properties/01';
  let filesToImport;
  try {
    filesToImport = files.map(f => {
      let linkName = prefix + (i + "tmp-").padStart(6, '0') + basename(f);
      i++;
      let fileAbs = fs.realpathSync(f);
      fs.symlinkSync(linkName, fileAbs);
      return linkName;
    })
    cfgImport.generateGlobalConfig({
      '--comment': options['--comment']
        || 'Generated with import of additional files:' + filesToImport.join('\n')
    }, targetDir, null);
  } finally {
    filesToImport.filter(f => fs.existsSync(f)).forEach(f => fs.unlinkSync(f));
  }

});

API['-h'] = API['--help'] = function() {
  //get full documentation, then re-execute the real help method
  let help = require("./config.libs/cmdline-descriptions.js");
  help.printHelp(...arguments);
}

let args = process.argv.slice(2)
if (args.length == 0) args.push('--help');
if (typeof API[args[0]] == "undefined") {
  args.unshift('--help');
}

console.log(API[args[0]](...args.slice(1)) || '')
