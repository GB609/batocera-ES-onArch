#!/usr/bin/node

let api = require("./config.libs/cmdline-api.js");
const data = require('./config.libs/data-utils.js');
Object.assign(globalThis, require('./config.libs/path-utils.js'));
const fs = require('fs');
const API = {};

const UNSUPPORTED_KEYS = ['kodi', 'led', 'splash', 'updates', 'wifi2', 'wifi3']
const SUPPORTED_PROPERTIES = require('./conf.d/supported_configs.json');
const SUPPORTED_SYSTEMS = require('./conf.d/supported_systems.json');
const SUPPORTED_EMULATORS = require('./conf.d/supported_emulators.json');


API.btcPropDetails = function(propLine, value) {
  if (typeof value != "undefined") { propLine = `${propLine}=${value}` }
  let { analyseProperty } = require('./config.libs/parsing.js');

  let analysedProp = analyseProperty(propLine);
  let file = "batocera-emulationstation/system.conf";
  if (SUPPORTED_SYSTEMS.includes(analysedProp.effectiveKey[0])) {
    file = "batocera-emulationstation/emulators.conf";
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
  { '*--type': ['game', 'system'], '*--format': ['sh', 'json', 'conf', 'yml'], '--strip-prefix': /\d+/ },
  (options, relativeRomPath) => {
    let fsRoot = process.env['FS_ROOT'] || '';
    let propertyFiles = [];
    console.debug("options are:", options)
    switch (options['--type']) {
      default:
      case 'game':
        propertyFiles.push(`${fsRoot}/etc/batocera-emulationstation/emulators.conf`);
        let romInfo = romInfoFromPath(relativeRomPath); 
        propertyFiles.push(romInfo.system + '/folder.conf');
        romInfo.subfolders.reduce((appended, current) => {
          return propertyFiles.push(`${appended += '/' + current}/folder.conf`), appended;
        }, romInfo.system);
        propertyFiles.push(`${relativeRomPath}/folder.conf`);
        propertyFiles.push(`${relativeRomPath}.conf`);
        break;
      case 'system':
        propertyFiles.push(`${fsRoot}/etc/batocera-emulationstation/system.conf`);
        break;
    }

    let merged = mergePropertyFiles(propertyFiles);
    let writer = require('./config.libs/output-formats.js');
const { romInfoFromPath } = require("./config.libs/path-utils.js");
    writer[options['--format']].write(merged, process.stdout, { stripPrefix: options['--strip-prefix'] });
  });

function mergePropertyFiles(files, options = {}) {
  let parser = require('./config.libs/parsing.js');
  let properties = {};
  options = Object.assign({ ignoreInvalid: true, filterSupported: true }, options);
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

  if (!(options.filterSupported === true)) { return properties }

  //post-processings: optional filter
  let cleanedProperties = {};
  [...SUPPORTED_PROPERTIES, ...SUPPORTED_SYSTEMS].map(data.HierarchicKey.from).forEach(prop => {
    //use deep assign instead of merge (or plain assignment) so that the SUPPORTED_ arrays can also use dot-notation to include sub-dict support only
    let value = prop.get(properties, null);
    if (value != null) { prop.set(cleanedProperties, value) }
  });
  UNSUPPORTED_KEYS.map(data.HierarchicKey.from).forEach(hk => {
    hk.delete(cleanedProperties);
  });
  return cleanedProperties;
}

API.importBatoceraConfig = api.action({ '-o': 1, '-s': 1 }, (options, ...files) => {
  const path = require('node:path');

  let targetDir = options["-o"] || "/etc";

  let properties = mergePropertyFiles(files, {
    preMergeAction: (dict) => {
      [...Object.values(dict)].forEach(value => {
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
      return dict;
    }
  });
  let imploded = data.deepImplode(properties);
  let byTargetFile = {};
  for (let [key, value] of Object.entries(imploded)) {
    let parsed = API.btcPropDetails(key, value);
    if (!parsed) { continue }

    //'core' is useless for most basic emulators, especially when it just is identical
    //drop this duplication after everything has been merged
    if (parsed.effectiveKey.last() == "core") {
      let emu = data.HierarchicKey.from(parsed.effectiveKey.parent(), 'emulator');
      if (imploded[emu] == parsed.value) { continue }
    }

    let targetObj = byTargetFile[parsed.file] ||= {};
    targetObj[key] = value;
  }

  for (let [filename, props] of Object.entries(byTargetFile)) {
    let lines = [];
    let keysSorted = [...Object.keys(props)].sort();

    for (let key of keysSorted) {
      let p = props[key];
      lines.push(`${key}=${p}`);
    }

    if (lines.length > 0) {
      console.log(`writing file ${filename} with ${lines.length} lines`);
      let finalFilePath = targetDir + '/' + filename;

      fs.mkdirSync(path.dirname(finalFilePath), { recursive: true })
      fs.writeFileSync(finalFilePath, lines.join('\n'));
    }
  }
});

API.test = api.action(
  { '-flag': 0, '*-oneArg': ['A', 'B'], '2': /\d{4}/, '--list': 'csv', '--var': api.VALIDATORS.varArgs((e, i) => i < 3) },
  (options, pos1, pos2) => {
    API.test.description('test')
  },
  'Run a test of what was implemented'
)

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
