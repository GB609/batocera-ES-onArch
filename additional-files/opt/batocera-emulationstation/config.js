#!/usr/bin/node

let api = require("./config.libs/cmdline-api.js");
const data = require('./config.libs/data-diff-merge.js');
const fs = require('fs');
const API = {};

const UNSUPPORTED_KEYS = ['kodi', 'led', 'splash', 'updates', 'wifi2', 'wifi3']
const SUPPORTED_PROPERTIES = require('./conf.d/supported_configs.json');
const SUPPORTED_SYSTEMS = require('./conf.d/supported_systems.json');

const FILE_TYPES = {
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
}

API.btcPropDetails = function(propLine, value) {
  if(typeof value != "undefined"){ propLine = `${propLine}=${value}` }
  let { analyseProperty } = require('./config.libs/parsing.js');

  let analysedProp = analyseProperty(propLine);
  let file = "batocera-emulationstation/system.conf";
  if (SUPPORTED_SYSTEMS.includes(analysedProp.effectiveKey[0])) {
    file = "batocera-emulationstation/emulators.conf";
  }

  return Object.assign(analysedProp, { file: file });
}

API.generate = api.action({ '--romdir': 1 }, async (options, type, sourceFile, targetDir) => {
  let parser = require('./config.libs/parsing.js');
  let data = parser.yamlToDict(sourceFile);
  let romDirPath = options['--romdir'] || process.env['ROMS_ROOT_DIR'] || "~/ROMs";
  if (type == "systems") {
    const launchCommand = "emulatorlauncher %CONTROLLERSCONFIG% -system %SYSTEM% -rom %ROM% -gameinfoxml %GAMEINFOXML% -systemname %SYSTEMNAME%  -emulator %EMULATOR% -core %CORE%"
    Object.keys(data).filter(k => SUPPORTED_SYSTEMS.includes(k)).forEach(key => {
      let system = data[key];
      process.stdout.write(`
  <system>
    <fullname>${system.name}</fullname>
    <name>${key}</name>
    <manufacturer>${system.manufacturer}</manufacturer>
    <release>${system.release || 'None'}</release>
    <hardware>${system.hardware || 'None'}</hardware>
    <path>${romDirPath + '/' + key}</path>
    <extension>${(system.extensions || []).map(e => '.' + e).join(' ')}</extension>
    <command>${launchCommand}</command>
    <platform>${system.platform || key}</platform>
    <theme>${system.theme || key}</theme>
    ${system.group ? `<group>${system.group}</group>` : '<!-- <group>none</group> -->'}
    <emulators>
      <emulator name="cdogs">
        <cores>
          <core default="true">cdogs</core>
        </cores>
      </emulator>
    </emulators>
  </system>
      `);
    })
  }
})

API.effectiveProperties = api.action(
  { '--type': ['game', 'system'], '--format': ['sh', 'json', 'conf', 'yml'], '--strip-prefix': 0 },
  (options, relativeRomPath) => {
    let fsRoot = process.env['FS_ROOT'] || '';
    let propertyFiles = [];
    switch (options['--type'].pop()) {
      default:
      case 'game':
        break;
      case 'system':
        propertyFiles.push(`${fsRoot}/etc/batocera-emulationstation/system.conf`);
        break;
    }

    let merged = mergePropertyFiles(propertyFiles);
    let writer = require('./config.libs/output-formats.js');
  });

function mergePropertyFiles(files, options = {}) {
  let parser = require('./config.libs/parsing.js');
  let properties = {};
  options = Object.assign({ ignoreInvalid: true, filterSupported: true }, options);
  let preMerge = options.preMergeAction || (dict)=>dict;
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
      [...Object.entries(dict)].forEach(key, value){
        if(typeof value.options != "undefined"){
          let options = value.options;
          Object.assign(value, value.options);
          if(Object.is(options, value.options)) { delete value.options }
        }
      }
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

API[args[0]](...args.slice(1))
