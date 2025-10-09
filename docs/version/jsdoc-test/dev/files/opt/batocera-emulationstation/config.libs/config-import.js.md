# /opt/batocera-emulationstation/config.libs/config-import.js

## Index

* [button](#button)

### button

[static method]
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
See [_key_to_sdl_game_controller_config](https://github.com/batocera-linux/batocera.linux/blob/master/package/batocera/core/batocera-configgen/configgen/configgen/controller.py)


<sub>Generated with shdoc</sub>