const fs = require('node:fs');

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
    } else {
      throw 'Not a valid file descriptor/name: ' + target;
    }
  }

  write(data) {
    data = asString(data);
    if (data.length == 0) { return }
    fs.writeFileSync(this.handle, data, { flag: 'a' });
  }
}

class ConfWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new ConfWriter(targetFile);
  }
}

class JsonWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new JsonWriter(targetFile);
    writer.write(JSON.stringify(dict), null, 2);
  }
}

class YamlWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new YamlWriter(targetFile);
    let jsonString = JSON.stringify(dict, null, 2);
    jsonString = jsonString.split('\n').map(_ => _.substring(2).replaceAll(/\{|\},?/g, '').replace(/\],$/, ']'));
    writer.write(jsonString);
  }
}

class ShellWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new ShellWriter(targetFile);
    writer.write(JSON.stringify(dict, null, 2))
  }
}

class EsSystemsWriter extends Writer {
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
  static write(dict, targetFile, options) {
    let writer = new EsSystemsWriter(targetFile);

    console.error("write es_systems with options:", options);
    options.comment ||= 'This file was generated from /opt/batocera-emulationstation/conf.d/es_systems.yml during PKGBUILD';
    options.attributes ||= ['name', 'manufacturer', 'release', 'hardware', 'path', 'extension', 'command', 'platform', 'theme', 'emulators'];
    if (!options.attributes.includes('key')) options.attributes.unshift('key');

    writer.write([
      '<?xml version="1.0"?>',
      `<!-- ${options.comment} -->`,
      '<systemList>\n'
    ]);
    Object.keys(dict).filter(options.filter).forEach(key => {
      let system = dict[key];
      writer.write(writer.systemToXml(key, system, options));
    });
    writer.write('</systemList>\n');
  }

  systemToXml(key, system, options) {
    //initialize defaults
    system.key = key;
    system.release ||= 'None';
    system.hardware ||= 'None';
    system.platform ||= key;
    system.theme ||= key;
    system.path ||= options.romDir + '/' + key;
    system.command ||= options.launchCommand;

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
  static write(dict, targetFile, options) {
    let writer = new EsFeaturesWriter(targetFile);
    options.comment ||= 'This file was generated from /opt/batocera-emulationstation/conf.d/es_features.yml during PKGBUILD';

    console.error("write es_features with options:", options);

    //make a working copy because we are going to change it during parsing
    dict = JSON.parse(JSON.stringify(dict));

    writer.write([
      '<?xml version="1.0"?>',
      `<!-- ${options.comment} -->`,
      '<features>\n',
    ]);

    if (typeof dict.shared.cfeatures == "object") {
      writer.write([
        whitespace(2) + '<sharedFeatures>',
        ...writer.createFeatureDefinitionsXml(dict.shared.cfeatures, 4),
        whitespace(2) + '</sharedFeatures>\n'
      ]);
      delete dict.shared;
    }

    if (typeof dict.global != "undefined" && Array.isArray(dict.global.shared)) {
      writer.write([
        whitespace(2) + '<globalFeatures>',
        ...writer.createSharedLinkXml(dict.global.shared, 4),
        whitespace(2) + '</globalFeatures>\n'
      ]);
      delete dict.global;
    }

    Object.keys(dict).filter(options.filter).forEach(key => {
      let emulator = dict[key];
      writer.write(writer.createFeatureContainerXml(emulator, 'emulator', key, 2));
      writer.write('\n');
    });

    writer.write('</features>\n');
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
      let featureTag = `<feature name="${value.prompt}" value="${key}"`;
      delete value.prompt;
      Object.keys(value).forEach(k => {
        if (k == "choices") { return }
        featureTag += ` ${k}="${value[k]}"`
      });
      lines.push(featureTag + '>');
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
