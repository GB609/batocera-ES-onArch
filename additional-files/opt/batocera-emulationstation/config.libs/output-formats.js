const fs = require('node:fs');
const { dirname } = require('node:path');
const { deepImplode, deepKeys, HierarchicKey } = require('./data-utils');

function asString(data) {
  if (Array.isArray(data)) { return data.join('\n') }
  else { return data.valueOf().toString() }
}

function whitespace(numSpaces) { return ''.padEnd(numSpaces, ' '); }

class Writer {
  constructor(target) {
    if (Number.isInteger(target) || Number.isInteger(target.fd)) {
      this.handle = target.fd || target;
    } else if (typeof target.valueOf() == 'string') {
      this.handle = fs.openSync(target, 'w');
      this.selfOpened = true;
    } else {
      throw 'Not a valid file descriptor/name: ' + target;
    }
  }

  static write(dict, targetFile, options) {
    let actualWriter = new this(targetFile);
    try {
      actualWriter.writeDict(dict, options);
    } finally {
      actualWriter.close();
    }
  }

  write(data) {
    data = asString(data);
    if (data.length == 0) { return }
    fs.writeFileSync(this.handle, data, { flag: 'a' });
  }

  close() {
    if (this.selfOpened == true) { fs.closeSync(this.handle) }
  }
}

class ConfWriter extends Writer {
  writeDict(dict, options) {
    let imploded = deepImplode(dict);
    let keysSorted = [...Object.keys(imploded)].sort();

    if (options.comment) { this.write(options.comment + '\n\n') }
    for (let key of keysSorted) {
      let val = imploded[key];
      if (options.printSource) { this.write(`#${val.source}\n`) }
      this.write(`${key}=${val}\n`);
    }
  }
}

class JsonWriter extends Writer {
  writeDict(dict, options) { this.write(JSON.stringify(dict, null, 2)) }
}

class YamlWriter extends Writer {
  writeDict(dict, options) {
    let jsonString = JSON.stringify(dict, null, 2);
    jsonString = jsonString.split('\n').map(_ => _.substring(2).replaceAll(/\{|\},?/g, '').replace(/\],$/, ']'));
    this.write(jsonString);
  }
}

class ShellWriter extends Writer {
  writeDict(dict, options) {
    let resultKeyLevelStart = options.stripPrefix || 0;
    let keys = deepKeys(dict);
    let reorganized = {};
    let declaredProps = {};

    for(let k of keys){
      let adjustedKey;
      if(k.length <= resultKeyLevelStart) { adjustedkey = k }
      else { adjustedKey = k.slice(resultKeyLevelStart) }
      adjustedKey = new HierarchicKey(adjustedKey.shift(), ...(adjustedKey.length > 0 ? [adjustedKey.join('_')] : []));
      if(typeof declaredProps[adjustedKey] != "undefined"){
        console.warn('Property name collision on sublevel after prefix ()%s stripping (overriding previous):\n\t%s\n\t%s',
                     resultKeyLevelStart, declaredProps[adjustedKey], k);
      }
      declaredProps[adjustedKey] = k;
      adjustedKey.set(reorganized, k.get(dict));
    }

    let dcl = options.declareCommand || 'declare';
    Object.entries(declaredProps).flatMap(entry=>{
      let k = entry[0];
      let v = entry[1];
      if(typeof v.value() == "object"){
        let entries = [[ `${dcl} -A ${k}` ]];
        for(let [sk, sv] of Object.entries(v)){
          entries.push([ `${k}['${sk}']='${sv}'`, sv.source ]);
        }
        return entries;
      } else {
        return [[ `${dcl} ${k}='${v}'`, v.source]]
      }
    }).forEach(line => {
      let comment = (options.printSource) ? ` # ${line[1]}\n` : '';
      this.write(`${line[0]}${comment}\n`)
    }
  }
}

class EsSystemsWriter extends Writer {
  static #DEFAULT_LAUNCH_COMMAND = "emulatorlauncher %CONTROLLERSCONFIG% -system %SYSTEM% -rom %ROM% -gameinfoxml %GAMEINFOXML% -systemname %SYSTEMNAME%";
  static #ATTRIBUTE_HANDLER = new class {
    key(system) { return [`<name>${system.key}</name>`] }
    name(system) { return [`<fullname>${system.name}</fullname>`] }
    extensions(system) { return [`<extension>${(system.extensions || []).map(e => '.' + e).join(' ')}</extension>`] }
    emulators(system) {
      return [
        '<emulators>',
        ...EsSystemsWriter.#ATTRIBUTE_HANDLER.emulatorsToXml(system.emulators).map(_ => whitespace(2) + _),
        '</emulators>'
      ]
    }
    emulatorsToXml(emulators) {
      let lines = [];
      for (let [key, value] of Object.entries(emulators)) {
        lines.push(`<emulator name="${key}"><cores>`);
        Object.keys(value).forEach(core => {
          lines.push(`${whitespace(2)}<core>${core}</core>`);
        });
        lines.push(`</cores></emulator>`);
      };
      return lines;
    }
    valueToTag(system, prop) { return [`<${prop}>${system[prop]}</${prop}>`] }
  }();

  writeDict(dict, options) {
    console.error("write es_systems with options:", options);
    options.comment ||= 'This file was generated from /opt/batocera-emulationstation/conf.d/es_systems.yml during PKGBUILD';
    options.attributes ||= ['name', 'manufacturer', 'release', 'hardware', 'path', 'extension', 'command', 'platform', 'theme', 'emulators'];
    if (!options.attributes.includes('key')) options.attributes.unshift('key');
    options.filter ||= () => true;

    this.write([
      '<?xml version="1.0"?>',
      `<!-- ${options.comment} -->`,
      '<systemList>\n'
    ]);
    Object.keys(dict).filter(options.filter).forEach(key => {
      let system = dict[key];
      this.write(this.systemToXml(key, system, options));
    });
    this.write('</systemList>\n');
  }

  systemToXml(key, system, options) {
    //initialize defaults
    system.key = key;
    system.release ||= 'None';
    system.hardware ||= 'None';
    system.platform ||= key;
    system.theme ||= key;
    system.path ||= options.romDir + '/' + key;
    system.command ||= EsSystemsWriter.#DEFAULT_LAUNCH_COMMAND;

    let lines = [];
    options.attributes.forEach(attribute => {
      if (typeof system[attribute] == "undefined") { return }

      let handler = EsSystemsWriter.#ATTRIBUTE_HANDLER[attribute] || EsSystemsWriter.#ATTRIBUTE_HANDLER.valueToTag;
      let handlerResult = handler(system, attribute);
      if (typeof Array.isArray(handlerResult)) lines.push(...handlerResult.map(_ => whitespace(2) + _));
    });
    if (lines.length == 0) { return '' }
    else return [
      whitespace(2) + '<system>',
      ...lines,
      '</system>\n'
    ].join('\n' + whitespace(2));
  }
}

class EsFeaturesWriter extends Writer {
  writeDict(dict, options) {
    options.comment ||= 'This file was generated from /opt/batocera-emulationstation/conf.d/es_features.yml during PKGBUILD';

    console.error("write es_features with options:", options);

    //make a working copy because we are going to change it during parsing
    dict = JSON.parse(JSON.stringify(dict));

    this.write([
      '<?xml version="1.0"?>',
      `<!-- ${options.comment} -->`,
      '<features>\n',
    ]);

    if (typeof dict.shared.cfeatures == "object") {
      this.write([
        whitespace(2) + '<sharedFeatures>',
        ...this.createFeatureDefinitionsXml(dict.shared.cfeatures, 4),
        whitespace(2) + '</sharedFeatures>\n'
      ]);
      delete dict.shared;
    }

    if (typeof dict.global != "undefined" && Array.isArray(dict.global.shared)) {
      this.write([
        whitespace(2) + '<globalFeatures>',
        ...this.createSharedLinkXml(dict.global.shared, 4),
        whitespace(2) + '</globalFeatures>\n'
      ]);
      delete dict.global;
    }

    Object.keys(dict).filter(options.filter).forEach(key => {
      let emulator = dict[key];
      this.write(this.createFeatureContainerXml(emulator, 'emulator', key, 2));
      this.write('\n');
    });

    this.write('</features>\n');
  }

  createFeatureContainerXml(data, rootTagName, name, whitespaces = 2) {
    let lines = [];

    let emulatorTag = `${whitespace(whitespaces)}<${rootTagName} name="${name}"`
    if (Array.isArray(data.features)) { emulatorTag += ` features="${data.features.join(', ')}"` }
    lines.push(emulatorTag + '>');

    if (typeof data.systems == "object") {
      lines.push(
        whitespace(whitespaces + 2) + '<systems>',
        ...Object.entries(data.systems).flatMap(entry => {
          return this.createFeatureContainerXml(entry[1], 'system', entry[0], whitespaces + 4)
        }),
        whitespace(whitespaces + 2) + '</systems>'
      );
    }
    lines.push(...this.createSharedLinkXml(data.shared, whitespaces + 2));
    lines.push(...this.createFeatureDefinitionsXml(data.cfeatures, whitespaces + 2));
    lines.push(`${whitespace(whitespaces)}</${rootTagName}>`);
    return lines;
  }

  createSharedLinkXml(sharedArray = [], whitespaces = 4) {
    return sharedArray.map(_ => `${whitespace(whitespaces)}<sharedFeature value="${_}" />`);
  }

  createFeatureDefinitionsXml(cfeatureDict = {}, whitespaces = 4) {
    let lines = [];
    for (let [key, value] of Object.entries(cfeatureDict)) {
      let featureTagAdditions = [];
      Object.keys(value).filter(k => k != 'choices').forEach(k => {
        featureTagAdditions.push(`${k}="${value[k]}"`);
      });
      lines.push(`<feature name="${value.prompt}" value="${key}" ${featureTagAdditions.join(' ')}>`);
      delete value.prompt;

      if (typeof cfeatureDict.preset == "undefined" && typeof value.choices == "object") {
        Object.keys(value.choices).forEach(k => {
          lines.push(`${whitespace(2)}<choice name="${k}" value="${value.choices[k]}" />`);
        });
      }
      lines.push('</feature>');
    }
    return lines.map(_ => whitespace(whitespaces) + _);
  }
}

module.exports = {
  conf: ConfWriter,
  sh: ShellWriter,
  yml: YamlWriter,
  json: JsonWriter,
  systems: EsSystemsWriter,
  features: EsFeaturesWriter
}
