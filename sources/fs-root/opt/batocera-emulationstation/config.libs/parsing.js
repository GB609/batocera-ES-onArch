/**
 * @file
 * @description
 * This file contains a set of very simple parsers providing just enough of the specs/grammars 
 * to handle the different property file languages and styles used in batocera.linux:
 * - es_systems.yml
 * - es_features.yml
 * - configgen-*.yml
 * - *.conf files
 * - *.cfg files
 * - *.json
 * - *.xml
 * 
 * For XML and YAML formatted files, an external tool will be used (xq and yq) to transform to json first. 
 * This makes those types effectively twice as expensive to process.  
 * Thus, where speed matters, the user should not use yml. Moreover, frequently parsed files should be handled with 
 * dedicated in-process parsing functions.  
 * Example: `es_settings.cfg` is an xml file, but very simply structured.
 */
const log = require('./logger.js').get()
const data = require('./data-utils.js');

const path = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process')

const SOURCE_FILE = Symbol.for('#SOURCE');
let CURRENT_FILE;

const PARSE_FUNCTIONS = Object.freeze({
  '.yml': yamlToDict,
  '.yaml': yamlToDict,
  '.conf': confToDict,
  '.json': jsonToDict,
  '.cfg': esSettingsToDict,
  '.xml': xmlToDict,
  '.amgp': xmlToDict
});

const CONTENT_PROVIDER = Object.freeze({
  DIRECT: (filename, split = true) => {
    let result = existsSync(filename)
      ? readFileSync(filename, { encoding: 'utf8' })
      : filename;
    if (split) { result = result.split('\n') }
    return result;
  },
  YQ: (filename, split = true) => {
    return existsSync(filename)
      ? execSync(`cat "${filename}" | yq`, { encoding: 'utf8' })
      : execSync('yq', { encoding: 'utf8', input: filename });
  },
  XQ: (filename, split = true) => {
    return existsSync(filename)
      ? execSync(`cat "${filename}" | xq`, { encoding: 'utf8' })
      : execSync('xq', { encoding: 'utf8', input: filename });
  }
});

/**
 * This function is the main entrance to this file.  
 * It tries to auto-detect the parser function to use depending on the file type.  
 * The detection is rudimentary, it goes by extension. Concrete handler functions are looked up
 * in a constant object named `PARSE_FUNCTIONS`.
 * 
 * All handler functions follow the same contract:
 * - They will generally return nested object structures.
 * - Each actual property entry will we wrapped in an instance of `PropValue`.  
 * 
 * @exported
 * @see class PropValue
 */
function parseDict(confFile, overrides = []) {
  if (typeof confFile == "string" && !existsSync(confFile)) {
    //a string, but not a file path -> assume '.'-imploded property keys
    return confToDict(confFile.split('\n'));
  }

  try {
    let resultDict = path.extname(confFile);
    let parser = PARSE_FUNCTIONS[resultDict];

    if (typeof parser == "undefined") { throw new Error('unsupported file type/extension: ' + confFile) }
    CURRENT_FILE = confFile;
    resultDict = parser(confFile);
    resultDict[SOURCE_FILE] = confFile;
    return resultDict;
  } catch (e) {
    log.error("Could not parse file:", confFile, e);
    return {}
  }
}

/**
 * Handles `*.conf` files like `batocera.conf`.  
 * Capable of unpacking batocera's special syntaxes into regular tree structures:
 * - system["<game-name>"].something=...
 * - system.folder["<folder-path>"].something=...
 * 
 * @exported
 * @see analyseProperty
 */
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

  decodeValue: function(value) {
    return value.replace(XML.ENCODED_CHARS_REGEX, match => {
      switch (match) {
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

function jsonToDict(jsonFile, contentProvider = CONTENT_PROVIDER.DIRECT) {
  let isNativeJson = contentProvider == CONTENT_PROVIDER.DIRECT;

  function noComment(line) { return !/\s*\/\/.*/.test(line) }
  function propertyNodeCreator(key, value) {
    if (typeof value == "object" && value != null) { return value }
    else { return handleValue(String(value)) }
  }
  return readTextPropertyFile(jsonFile, (lines) => {
    let data = isNativeJson
      ? lines.filter(noComment).join('\n')
      : lines;
    return JSON.parse(data, propertyNodeCreator);
  }, contentProvider, isNativeJson);
}

function xmlToDict(xmlFile) {
  return jsonToDict(xmlFile, CONTENT_PROVIDER.XQ);
}

function yamlToDict(yamlFile) {
  return jsonToDict(yamlFile, CONTENT_PROVIDER.YQ);
}

function yamlToDict_old(yamlFile) {
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

/**
 * @section INTERNAL SUPPORT CLASSES AND FUNCTIONS
 * @description
 * Most of the classes and functions following this block are for parsing yml files
 * as this is the most complex format.
 * @endsection 
 */
function readTextPropertyFile(confFile, dataLinesCallback, contentProvider = CONTENT_PROVIDER.DIRECT, ...providerArgs) {
  if (Array.isArray(confFile)) { return dataLinesCallback(confFile); }

  log.debug('TRY READING %s', confFile);
  if (existsSync(confFile)) { log.info('READ %s', confFile) }
  else { log.info('Data to parse is string...') }
  try {
    let content = contentProvider(confFile, ...providerArgs);
    return dataLinesCallback(content);
  }
  catch (e) { log.error(e); }
}

/** YAML FILES */
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
   * return false if the current line is NOT processed by handler,
   * but only serves as terminator
   */
  endBlock() { throw 'must be implemented with (state, line)' }

  recalcDepth(state, line) {
    let newDepth = WHITESPACE.exec(line)[1].length || 0;
    if (newDepth > this.depth) { state.stepWidth = newDepth - this.depth }
    return state.depth = newDepth, newDepth;
  }
  lineDepth(line) { return WHITESPACE.exec(line)[1].length || 0; }
}

class StringMultiline extends MLModeHandler {
  constructor(state, line, key) {
    super("STRING", state, () => false);
    let lines = this.lines = [];
    this.depth = this.lineDepth(line);
    Object.defineProperty(state.stack.peek(), key, {
      enumerable: true, get() { return lines.join('\n').trim(); }
    });
    state.stack.push(this);
  }

  continue(state, line) {
    if (!this.stringDepth) { this.stringDepth = this.recalcDepth(state, line); }
    this.lines.push(line.substring(this.stringDepth).trimEnd());
  }
  isEnd(state, line) {
    let depth = WHITESPACE.exec(line)[1].length || 0;
    return line.length > 0 && depth <= this.depth;
  }
  endBlock(state) { return state.stack.pop(), false; }
}

class ListMultiline extends MLModeHandler {
  static LIST_LINE = /^(\s*\-\s*)(.*?)\s*?(#.*)?$/;
  constructor(state, line, key) {
    super("LIST", state);
    let lines = this.lines = state.stack.peek();
    lines[Symbol.for("MK_ARR")]();
    this.depth = lines[Symbol.for("depth")];
    state.stack.push(this);
    state.lineDone = false
  }

  continue(state, line) {
    let value = ListMultiline.LIST_LINE.exec(line)[2];
    try {
      state.stack.push(this.lines);
      parseYamlLine(state, `${''.padStart(this.depth + 2, ' ')}${this.lines.length}: ${value}`);
    } finally {
      if (state.stack.peek() == this.lines) { state.stack.pop(); }
    }
  }
  isEnd(state, line) { return !ListMultiline.LIST_LINE.test(line); }
  endBlock(state) { return state.stack.pop(), false; }
}

class ArrayMultiline extends MLModeHandler {
  static VALUE_TRIMMER = /^\s*\[?\s*(.*?)\s*\]?\s*$/;
  constructor(state, line, key, value) {
    super("ARRAY", state);
    this.depth = this.recalcDepth(state, line);
    let lines = this.concatted = [];
    this.continue(state, value);
    this.oneLiner = this.isEnd(state, value);
    Object.defineProperty(state.stack.peek(), key, {
      enumerable: true, get() { return lines.join('\n').split(/,\s+/).map(handleValue); }
    });
    state.stack.push(this);
  }
  continue(state, line) { this.concatted.push(ArrayMultiline.VALUE_TRIMMER.exec(line)[1]); }
  isEnd(state, line) { return this.oneLiner || /.*\]\s*$/m.test(line); }
  endBlock(state, line) {
    state.stack.pop();
    if (this.oneLiner) { return false; }
    else { return this.continue(state, line), true; }
  }
}

/* FIXME: can't handle dictionaries broken across multiple lines. Spec or not?
class InlineDict extends MLModeHandler {
  constructor(state, line, key, value) {
    super("DICT", state);
    this.depth = this.recalcDepth(state, line);
    this.depth += state.stepWidth
    this.concatted = [];
    this.continue(state, value);
    this.oneLiner = this.isEnd(state, value);
    this.key = key;
    state.stack.push(this);
  }
  continue(state, line) { this.concatted.push(line.trim()) }
  isEnd(state, line) { return this.oneLiner || /.*}\s*$/m.test(line); }
  endBlock(state, line) {
    try{
    if(!this.oneLiner) { this.continue(state, line) }
    let source = this.concatted
      .join('\n')
      .match(/{(.*)}/)[1]
      .trim()
      .split(/,\s+/)
      .map(_ => _.trimStart())
      //.map(_ => ''.padStart(this.depth, ' ')+_);
    state.stack.pop();
    let parsed = yamlToDict(source);
    log.info("ending block", this, "with", source, "resulting in", parsed)
    state.stack.peek()[this.key] = parsed; 
    //if (this.oneLiner) { return false; }
    //else { return this.continue(state, line), true; }
    } catch (e) {
      console.error("error", e, "one liner?", this.oneLiner, "payload was", this.concatted);
    }
    return !this.oneLiner;
  }
}
*/

class DictMultiline extends MLModeHandler {
  constructor(state, line, key, value) {
    super("DICT", state);
    this.depth = this.recalcDepth(state, line);
    this.content = new FlexibleContainer(key, this.depth);
    this.parentKey = key;
    state.stack.peek()[key] = this.content;
    state.stack.push(this);
    this.previousStepWidth = state.stepWidth
  }
  continue(state, line) {
    try {
      this.recalcDepth(state, line);
      state.stack.push(this.content);
      parseYamlLine(state, line, this);
    } finally {
      if (state.stack.peek() == this.content) { state.stack.pop(); }
    }
  }
  isEnd(state, line) { return this.lineDepth(line) <= this.depth; }
  endBlock(state, line) {
    state.stack.pop();
    if (state.stack.peek() == this.content) state.stack.pop();
    return state.stepWidth = this.previousStepWidth, false;
  }
}

const SINGLE_QUOTED = /^'(.*)(?<!\\)'$/;
const DOUBLE_QUOTED = /^"(.*)(?<!\\)"$/;
function unquote(value) {
  let quoted;
  if ((quoted = SINGLE_QUOTED.exec(value)) != null) { value = quoted[1].replaceAll("\\'", "'") }
  else if ((quoted = DOUBLE_QUOTED.exec(value)) != null) { value = quoted[1].replaceAll('\\"', '"') }
  return value;
}

/**
 * Helper class that can be used to transport meta-information about the origin of a property.
 * Most use cases shouldn't care because of the valueOf implementation and just behave as if it was a string.
 * One notable exception is default initialisation by existence checks.
 */
class PropValue {
  constructor(val, source = CURRENT_FILE) {
    this.value = val;
    this.source = source;
  }

  toJSON() { return this.value }
  valueOf() { return this.value }
  toString() { return String(this.value) }
}
function handleValue(value) {
  try { return new PropValue(JSON.parse(value)); } catch (e) { }
  return new PropValue(unquote(value));
}
SINGLE_Q_W_COMMENT = /^('.*?(?<!\\)')([ ]+#.*)?$/;
DOUBLE_Q_W_COMMENT = /^(".*?(?<!\\)")([ ]+#.*)?$/;
function cleanYamlValue(value) {
  if (value == null) { return null }
  if (!value.includes('#')) { return value.trim() }

  value = value.trim();
  // # is included in quoted string
  if (SINGLE_QUOTED.test(value) || DOUBLE_QUOTED.test(value)) { return value }

  //either not quoted, or ["something" # comment]
  let quoted;
  if ((quoted = SINGLE_Q_W_COMMENT.exec(value)) != null) { return quoted[1] }
  else if ((quoted = DOUBLE_Q_W_COMMENT.exec(value)) != null) { return quoted[1] }
  //can only be unquoted
  return value.split(/\s*#/)[0];
}

// regex madness
// either match: 
// - arbitrary none-newline characters between 2 identical quotes
// - a single colon
// - an arbitrary sequence of characters, starting from the first none-whitespace, up until colon and/or newline
// this is not 100% spec - e.g. it can handle 'key: : sdt', which will result in value=': sdt'
const OBJ_LINE = /^\s+|("[^"]*")|('[^']*')|:(?=\s+)|\S.*?(?=: |:$|\s*$)/gm;
function parseYamlLine(state = {}, line = "") {
  let handler = state.stack.peek();
  if (handler instanceof MLModeHandler) {
    if (handler.canSkip(line)) { return }
    if (handler.isEnd(state, line)) {
      if (handler.endBlock(state, line)) { return }
      return state.lineDone = false;
    } else return handler.continue(state, line);
  }

  let trimmed = line.trim();
  switch (trimmed.charAt(0)) {
    case '#': return
    case '-': return new ListMultiline(state, line);
  }

  let whitespace = 0;
  let ymlLine = line.trimEnd().match(OBJ_LINE) || [''];
  // take care of leading whitespace and trailing \n
  if (ymlLine[0].trim().length == 0) { whitespace = ymlLine.shift().length }
  if (ymlLine.lastIndexOf('\n') == ymlLine.length - 1) { ymlLine.pop() }
  if (ymlLine.length < 2 || ymlLine[1] != ':') { return log.trace('skip line [%s]: "%s"', state.line, line) }

  if (ymlLine.length > 3) {
    let tempLine = line;
    tempLine = tempLine.slice(tempLine.indexOf(ymlLine[0]) + ymlLine[0].length);
    tempLine = tempLine.slice(tempLine.indexOf(ymlLine[1]) + ymlLine[1].length);
    ymlLine[2] = tempLine.slice(tempLine.indexOf(ymlLine[2]));
  }

  let subDict = state.stack.peek();
  if (whitespace <= subDict[Symbol.for("depth")]) {
    state.stack.pop();
    return state.lineDone = false
  }

  let key = handleValue(ymlLine[0].trim());
  let value = cleanYamlValue(ymlLine[2] || '');
  trimmed = `${ymlLine[2]}:${value}`.trim();
  if (trimmed.endsWith(':')) { return new DictMultiline(state, line, key, value) }
  else if (value != null && value.length > 0) {
    value = value.trim();
    switch (value.charAt(0)) {
      case '|': return new StringMultiline(state, line, key);
      case '[': return new ArrayMultiline(state, line, key, value);
      //case '{': return new InlineDict(state, line, key, value);
      default: try { value = handleValue(value); } catch (e) { }
    }
    subDict[key] = value;
  }
}

module.exports = {
  parseDict, analyseProperty,
  SOURCE_FILE,
  SUPPORTED_TYPES: Object.keys(PARSE_FUNCTIONS),
  confToDict, yamlToDict, jsonToDict, esSettingsToDict,
  XML,
  PropValue
}
