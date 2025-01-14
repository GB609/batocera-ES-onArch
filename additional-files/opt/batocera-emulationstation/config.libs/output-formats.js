const fs = require('node:fs');

function asString(data) {
  if (Array.isArray(data)) { return data.join('\n') }
  else { return data.valueOf().toString() }
}

function whitespace(numSpaces){ return ''.padEnd(numSpaces, ' '); }

class Writer {
  constructor(target) {
    if (Number.isInteger(target) || Number.isInteger(target.fd)) {
      this.handle = target.fd || target;
    } else if (typeof target.valueOf() == 'string') {
      this.handle = fs.openSync(target);
    } else {
      throw 'Not a valid file descriptor/name: ' + target;
    }
  }

  write(data) { fs.writeFileSync(this.handle, asString(data), { flag: 'a' }); }
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
  }
}

class EsSystemsWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new EsSystemsWriter(targetFile);

    options.comment ||= 'This file was generated from /opt/batocera-emulationstation/conf.d/es_systems.yml during PKGBUILD';

    writer.write([
      '<?xml version="1.0"?>',
      `<!-- ${options.comment} -->`,
      '<systemList>'
    ]);
    Object.keys(dict).filter(options.filter).forEach(key => {
      let system = dict[key];
      writer.write(writer.systemToXml(key, system, options));
    });
    writer.write('\n</systemList>\n');
  }

  systemToXml(key, system, options) {
    return `
  <system>
    <fullname>${system.name}</fullname>
    <name>${key}</name>
    <manufacturer>${system.manufacturer}</manufacturer>
    <release>${system.release || 'None'}</release>
    <hardware>${system.hardware || 'None'}</hardware>
    <path>${options.romDir + '/' + key}</path>
    <extension>${(system.extensions || []).map(e => '.' + e).join(' ')}</extension>
    <command>${options.launchCommand}</command>
    <platform>${system.platform || key}</platform>
    <theme>${system.theme || key}</theme>
    ${system.group ? `<group>${system.group}</group>` : '<!-- <group>none</group> -->'}
    <emulators>
${this.emulatorsToXml(system.emulators)}
    </emulators>
  </system>`
  }
  
  emulatorsToXml(emulators){
    let lines = [];
    for (let [key, value] of Object.entries(emulators)) {
      lines.push(`${whitespace(6)}<emulator name="${key}"><cores>`);
      Object.keys(value).forEach(core => {
        lines.push(`${whitespace(8)}<core>${core}</core>`);
      });
      lines.push(`${whitespace(6)}</cores></emulator>`);
    };
    return lines.join('\n');
  }
}

class EsFeaturesWriter extends Writer {
  static write(dict, targetFile, options) {
    let writer = new EsFeaturesWriter(targetFile);
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
