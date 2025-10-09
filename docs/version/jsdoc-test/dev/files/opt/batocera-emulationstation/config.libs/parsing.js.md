# /opt/batocera-emulationstation/config.libs/parsing.js

## Index

* [parseDict](#parsedict)
* [endBlock](#endblock)

### parseDict

A very simple yaml parser providing just enough to handle the different property file languages and styles
in batocera.linux:
- es_systems.yml
- es_features.yml
- configgen-*.yml
- *.conf files
Self-implemented to avoid a bigger dependency on npm and other, needlessly large node modules.

### endBlock

if (typeof confFile == "string" && !existsSync(confFile)) {
//a string, but not a file path -> assume '.'-imploded property keys
return confToDict(confFile.split('\n'));
}

let resultDict = path.extname(confFile);
let parser = PARSE_FUNCTIONS[resultDict];

if (typeof parser == "undefined") { throw new Error('unsupported file type/extension: ' + confFile) }
CURRENT_FILE = confFile;
resultDict = parser(confFile);
resultDict[SOURCE_FILE] = confFile;
return resultDict;
}

function confToDict(confFile) {
let assign = data.deepAssign;
return readTextPropertyFile(confFile, lines => {
let result = {};
for (let line of lines) {
let propLine = line.trim();
if (propLine.startsWith('#') || !propLine.includes("=")) { continue; }
let details = analyseProperty(propLine);
assign(result, details.effectiveKey, details.value);
}
return result;
})
}

const XML = {
ENCODED_CHARS_REGEX: /&lt;|&gt;|&amp;|&apos;|&quot;/,
removeComments: function removeComments(lines) {
if (Array.isArray(lines)) { lines = lines.join('\n') }

while (lines.includes('<!--')) {
let startIndex = lines.indexOf('<!--');
let endIndex = lines.indexOf('-->', startIndex);
lines = lines.substring(0, startIndex) + lines.substring(endIndex + 3);
}
return lines.split('\n');
},

decodeValue: function(value){
return value.replace(XML.ENCODED_CHARS_REGEX, match => {
switch(match) {
case '&lt;': return '<'
case '&gt;': return '>'
case '&amp;': return '&'
case '&apos;': return "'"
case '&quot;': return '"'
}
});
}
}

const CFG_PROP_LINE = /<\w+ name="(.*)" value="(.*)"\s*\/>/
function esSettingsToDict(cfgFile) {
return readTextPropertyFile(cfgFile, (lines) => {
lines = XML.removeComments(lines);
let result = {};
lines.map(_ => CFG_PROP_LINE.exec(_)).filter(_ => _ != null).forEach(line => {
let key = XML.decodeValue(line[1]);
let convertedProperty = `${key}=${line[2]}`;
let details = analyseProperty(convertedProperty);
details.effectiveKey.set(result, details.value);
});
return result;
});
}

function jsonToDict(jsonFile) {
function noComment(line) { return !/\s*\/\/.*/.test(line) }
function propertyNodeCreator(key, value) {
if (typeof value == "object" && value != null) { return value }
else { return handleValue(String(value)) }
}
return readTextPropertyFile(jsonFile, (lines) => {
return JSON.parse(lines.filter(noComment).join('\n'), propertyNodeCreator);
});
}

function yamlToDict(yamlFile) {
return readTextPropertyFile(yamlFile, (lines) => {
let result = new FlexibleContainer('#root', -1);
let state = { stack: new ParseStack(result), depth: result[Symbol.for("depth")], line: 0 }
for (let line of lines) {
try {
state.line++;
let retryCount = 0
do {
if (retryCount > 50) {
log.debug("Stop retrying line", `[${state.line}] '${line}'`, 'after 50 retries to prevent endless looping');
break;
}
retryCount++;
state.lineDone = true;
parseYamlLine(state, line);
} while (!state.lineDone)
} catch (e) {
log.error("LINE", line, "\nSTATE", state, e)
process.exit(1)
}
}
while (state.stack.length > 0) {
let current = state.stack.peek();
//last line in yml was a multi line, need to merge down and close block
if (current instanceof MLModeHandler) { current.endBlock(state, 'EOF') }
else { state.stack.pop() }
}
return result.valueOf();
});
}

const FOLDER_SPEC = /^\w+(\.folder\[(".*?")\/?\]).*=.*/;
const GAME_SPEC = /^\w+\[(".*?")\].*/;
function analyseProperty(propLine) {
let fspath = []
if (fspath = FOLDER_SPEC.exec(propLine)) {
propLine = propLine.replace(fspath[1], '');
fspath = ['folder', unquote(fspath[2])];
} else if (fspath = GAME_SPEC.exec(propLine)) {
fspath = fspath[1];
propLine = propLine.replace(`[${fspath}]`, '');
fspath = ['game', unquote(fspath)];
} else {
fspath = [];
}

let equalPos = propLine.indexOf('=');
let realKey = propLine.substring(0, equalPos).trim().split('.');
let effKey = [...realKey]

return {
effectiveKey: new data.HierarchicKey(effKey.shift(), ...fspath, ...effKey),
overridesKey: new data.HierarchicKey(...realKey),
value: handleValue(propLine.substring(equalPos + 1).trim())
}
}

/********* INTERNAL SUPPORT CLASSES AND FUNCTIONS *********/
function readTextPropertyFile(confFile, dataLinesCallback) {
if (Array.isArray(confFile)) { return dataLinesCallback(confFile); }

log.debug('TRY READING %s', confFile);
try {
if (existsSync(confFile)) {
log.info('READ %s', confFile);
return dataLinesCallback(readFileSync(confFile, { encoding: 'utf8' }).split("\n"));
} else {
//it's not a file, try to use it as a string
return dataLinesCallback(confFile.split('\n'))
}
}
catch (e) { log.error(e); }
}

/** YAML FILES **/
class ParseStack extends Array {
constructor() { super(...arguments); }
peek() { return this.at(-1); }
}

class FlexibleContainer extends Array {
static #unwrapFlex(object) {
return object instanceof FlexibleContainer
? object.valueOf() : object;
}
static #isNonEmpty(object) {
if (!Array.isArray(object) && object instanceof Object) { object = Object.keys(object); }
if (Array.isArray(object)) { return object.length > 0; }

return ("" + object).length > 0;
}

constructor(key, depth) {
super()
this[Symbol.for("ISOBJ")] = true;
this[Symbol.for("KEY")] = key;
this[Symbol.for("depth")] = depth;
}
[Symbol.for("MK_ARR")]() { this[Symbol.for("ISOBJ")] = false; }
valueOf() {
if (this[Symbol.for("ISOBJ")]) {
let obj = (this[Symbol.for("obj")] ||= {});
Object.keys(obj).forEach(k => {
if (typeof this[k] == "undefined") { delete obj[k]; }
});
Object.keys(this).forEach(k => {
let tmp = FlexibleContainer.#unwrapFlex(this[k]);
if (FlexibleContainer.#isNonEmpty(tmp)) { obj[k] = tmp; }
});
return obj;
} else {
let arr = (this[Symbol.for("arr")] ||= []);
arr.length = 0;
return arr.push(...Object.values(this).map(FlexibleContainer.#unwrapFlex)), arr;
}
}
toJSON() { return this.valueOf() }
}

const WHITESPACE = /^(\s*).*$/
class MLModeHandler {
constructor(type, state, skipTest = (line = "", trimmed = line.trim()) => trimmed.length == 0 || trimmed.startsWith('#')) {
this.type = type;
this.canSkip = skipTest;
this.depth = 0;
}
continue() { throw 'must be implemented with (state, line)' }
isEnd() { throw 'must be implemented with (state, line)' }
/**
return false if the current line is NOT processed by handler,
but only serves as terminator


<sub>Generated with shdoc</sub>