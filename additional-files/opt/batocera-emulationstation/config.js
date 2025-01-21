#!/usr/bin/node

let api = require("./config.libs/cmdline-api.js");
const data = require('./config.libs/data-diff-merge.js');
const fs = require('fs');
const API = {};

const UNSUPPORTED_KEYS = ['kodi', 'led', 'splash', 'updates', 'wifi2', 'wifi3']
const SUPPORTED_PROPERTIES = require('./conf.d/supported_configs.json');
const SUPPORTED_SYSTEMS = require('./conf.d/supported_systems.json');
const SUPPORTED_EMULATORS = require('./conf.d/supported_emulators.json');

/*const FILE_TYPES = {
  conf: {
    propLine: function(prop) {
      let lines = {};
      if (prop.comments && prop.comments.length > 0) {
        lines.push('');
        prop.comments.forEach(c => lines.push('#' + c));
      }
      let confLine = `${prop.key}=${prop.value}`;
      if (prop.commented) {
        confLine = '#' + confLine;
      }
      lines.push(confLine);

      return lines.join('\n');
    },

    parseLine: function(state, comments, line) { }
  },

  //for sourcing
  shell: {
    propLine: function(prop) {
      return prop.commented ? "" : `${prop.key}="${prop.value}"`;
    }
  },

  cfg: {
    propLine: function(prop) { },
    parseLine: function(state, comments, line) { }
  }
}
FILE_TYPES['yml'] = FILE_TYPES['yaml'] = {
  propLine: function(prop) { },
  parseLine: function(state, comments, line) { }
}*/

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
  { '--romdir': 1, '--as-override': 1, '--attributes': 1, '--comment': 1 },
  (options, type, sourceFile, targetDir) => {
    let parser = require('./config.libs/parsing.js');
    let data = parser.yamlToDict(sourceFile);

    let targetFile;
    if (typeof targetDir == "undefined") { targetFile = process.stdout }
    if (options['--attributes'].length > 0) {
      options['--attributes'] = options['--attributes'].shift().split(',');
    }
    if (options['--attributes'].length == 0) { delete options['--attributes'] }

    let comment = options['--comment'].shift() || 'Generated from ' + sourceFile;

    let output = require('./config.libs/output-formats.js');
    switch (type) {
      case "systems":
        let appendix = options['--as-override'].length > 0 ? '-' + options['--as-override'].shift() : '';
        targetFile ||= targetDir + `/es_systems${appendix}.cfg`;
        output.systems.write(data, targetFile, {
          filter: k => SUPPORTED_SYSTEMS.includes(k),
          romDir: options['--romdir'].shift() || process.env['ROMS_ROOT_DIR'] || "~/ROMs",
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
    switch (options['--type']) {
      default:
      case 'game':
        propertyFiles.push(`${fsRoot}/etc/batocera-emulationstation/emulators.conf`);
        let pathParts = /^(.*?)\/(.*\/)?(.*?)$/.exec(relativeRomPath);
        let system = pathParts[1];
        let game = pathParts[3];
        propertyFiles.push(system+'/folder.conf');
        let subfolders = (pathParts[2] ? pathParts[2].split('/') : []);
        subfolders.reduce((appended, current) => {
          return propertyFiles.push(`${appended += '/' + current}/folder.conf`), appended;
        }, system);
        propertyFiles.push(`${relativeRomPath}.conf`);
        break;
      case 'system':
        propertyFiles.push(`${fsRoot}/etc/batocera-emulationstation/system.conf`);
        break;
    }

    let merged = mergePropertyFiles(propertyFiles);
    let writer = require('./config.libs/output-formats.js');
    writer[options['--format']].write(merged, process.stdout, { stripPrefix: options['--strip-prefix'] });
  });

function mergePropertyFiles(files, options = {}) {
  let parser = require('./config.libs/parsing.js');
  let properties = {};
  options = Object.assign({ ignoreInvalid: true, filterSupported: true }, options);
  let preMerge = options.preMergeAction || (d => d);
  for (confFile of files) {
    if (!fs.existsSync(confFile)) {
      if (options.ignoreInvalid === true) { continue }
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
    prop.set(cleanedProperties, prop.get(properties));
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
      [...Object.value(dict)].forEach(value => {
        if (typeof value.options != "undefined") {
          let options = value.options;
          Object.assign(value, value.options);
          if (Object.is(options, value.options)) { delete value.options }

          if (value.emulator == value.core) { delete value.core }
        }
      })
    }
  });
  let imploded = data.deepImplode(properties);
  let byTargetFile = {};
  for (let [key, value] of Object.entries(imploded)) {
    let parsed = API.btcPropDetails(key, value);
    if (parsed) {
      let targetObj = byTargetFile[parsed.file] ||= {};
      targetObj[finalKey] = value;
    }

  }

  for (let [filename, props] of byTargetFile) {
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
  { '-flag' :0, '-oneArg' : 1, '2' : /\d{4}/, '--list' : 'csv', '--var': api.VALIDATORS.varArgs((e,i)=>i<3)}, 
  (options, pos1, pos2)=>{
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
