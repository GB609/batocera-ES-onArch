/**
 * A very simple yaml parser providing just enough to handle the different property file languages and styles
 * in batocera.linux:
 * - es_systems.yml
 * - es_features.yml
 * - configgen-*.yml
 * - *.conf files
 * Self-implemented to avoid a bigger dependency on npm and other, needlessly large node modules.
 */

const { readFileSync, existsSync } = require('node:fs');
const data = require('./data-diff-merge.js');

function parseDict(confFile, overrides = []) {
  if (typeof confFile == "string" && !existsSync(confFile)) {
    //a string, but not a file path -> assume '.'-imploded property keys
    return confToDict(confFile.split('\n'));
  }

  let resultDict;
  if (confFile.endsWith('.yaml') || confFile.endsWith('.yml')) {
    resultDict = yamlToDict(confFile);
  } else if (confFile.endsWith('.conf')) {
    resultDict = confToDict(confFile);
  }

  if (overrides.length > 0) {

  }

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

function yamlToDict(yamlFile) {
  return readTextPropertyFile(yamlFile, (lines) => {
    let result = new FlexibleContainer('#root', -1);
    let state = { stack: new ParseStack(result), depth: result[Symbol.for("depth")], line: 0 }
    for (let line of lines) {
      try {
        state.line++;
        let retryCount = 0
        do {
          if (retryCount > 10) {
            console.error("Stop retrying line", `'${line}'`, 'after 10 retries to prevent endless looping');
            break;
          }
          retryCount++;
          state.lineDone = true;
          parseYamlLine(state, line);
        } while (!state.lineDone)
      } catch (e) {
        console.error("LINE", line, "\nSTATE", state)
        console.error(e)
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

function analyseProperty(propLine) {
  let fspath = []
  if (fspath = FOLDER_SPEC.exec(propLine)) {
    propLine = propLine.replace(fspath[1], '');
    fspath = ['folder', fspath[2]];
  } else if (fspath = GAME_SPEC.exec(propLine)) {
    fspath = fspath[1];
    propLine = propLine.replace(`["${fspath}"]`, '');
    fspath = ['game', fspath];
  }

  let equalPos = propLine.indexOf('=');
  let realKey = propLine.substring(0, equalPos).split('.');
  let effKey = [...realKey]

  return {
    effectiveKey: new data.HierarchicKey(effKey.shift(), ...fspath, ...effKey),
    overridesKey: new data.HierarchicKey(...realKey),
    value: propLine.substring(equalPos + 1)
  }
}

/********* INTERNAL SUPPORT CLASSES AND FUNCTIONS *********/
function readTextPropertyFile(confFile, dataLinesCallback) {
  if (Array.isArray(confFile)) { return dataLinesCallback(confFile); }

  console.error('BEGIN READ: %s:', confFile);
  try {
    if (existsSync(confFile)) {
      return dataLinesCallback(readFileSync(confFile, { encoding: 'utf-8' }).split("\n"));
    } else {
      //it's not a file, try to use it as a string
      return dataLinesCallback(confFile.split('\n'))
    }
  }
  catch (e) { console.error(e); }
  finally { console.error("END READ: %s", confFile); }
}

/** YAML FILES **/
class ParseStack extends Array {
  constructor() { super(...arguments); }
  peek() { return this.at(-1); }
}

class FlexibleContainer extends Array {
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
      return Object.assign(obj, this), obj;
    } else {
      let arr = (this[Symbol.for("arr")] ||= []);
      arr.length = 0;
      return arr.push(...Object.values(this)), arr;
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
  static LIST_LINE = /^(\s*\-\s*)(.*?)\s*$/;
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
  isEnd(state, line) { return this.oneLiner || /.*\]\s*$/.test(line); }
  endBlock(state, line) {
    state.stack.pop();
    if (this.oneLiner) { return false; }
    else { return this.continue(state, line), true; }
  }
}

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

const SINGLE_QUOTED = /^'(.*)'$/;
const DOUBLE_QUOTED = /^"(.*)"$/;
function handleValue(value) {
  try { return JSON.parse(value); } catch (e) { }
  let quoted;
  if ((quoted = SINGLE_QUOTED.exec(value)) != null) { value = quoted[1].replaceAll("\\'", "'") }
  else if ((quoted = DOUBLE_QUOTED.exec(value)) != null) { value = quoted[1].replaceAll('\\"', '"') }
  return value;
}

// FIXME: regex can't handle quoted keys with special chars atm (see es_features.yml)
const OBJ_LINE = /^(\s*)(["']?[\w\d\-\+]+["']?)\:\s*(.*)/;
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

  let ymlLine = OBJ_LINE.exec(line);
  if (ymlLine == null) { return console.debug('skip line [%s]: "%s"', state.line, line) };

  let whitespace = ymlLine[1].length || 0;
  let subDict = state.stack.peek();
  if (whitespace <= subDict[Symbol.for("depth")]) {
    state.stack.pop();
    return state.lineDone = false
  }

  let key = handleValue(ymlLine[2]);
  let value = ymlLine[3];
  if (trimmed.endsWith(':')) { return new DictMultiline(state, line, key, value); }
  else if (value != null && value.length > 0) {
    value = value.trim();
    switch (value.charAt(0)) {
      case '|': return new StringMultiline(state, line, key);
      case '[': return new ArrayMultiline(state, line, key, value);
      default: try { value = handleValue(value); } catch (e) { }
    }
    subDict[key] = value;
  }
}

module.exports = { parseDict, confToDict, yamlToDict, analyseProperty }
