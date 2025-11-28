class HierarchicKey extends Array {
  static #JOINED = Symbol.for('JK');
  constructor() { super(...arguments); }
  parent() { return new HierarchicKey(...this.slice(0, this.length - 1)) }
  last() { return this[this.length - 1] }
  get(dict, defaultValue) { return deepGet(dict, this, defaultValue, false) }
  set(dict, value) { deepAssign(dict, this, value) }
  delete(dict) {
    let last = this.last();
    delete deepGet(dict, this.slice(0, this.length - 1), { [last]: true })[last];
  }
  toString() { return this[HierarchicKey.#JOINED] ||= HierarchicKey.join(this) }
  toJSON() { return this.toString(); }

  static from(...path) { return new HierarchicKey(...path.flatMap(splitKey)) }
  static join(keyArr) {
    let keyString = "";
    for (let k of keyArr) {
      let keyAppendix = false;
      if (k == parseInt(k).toString()) { keyAppendix = `[${k}]`; }
      else if (/\.|\/| /.test(k)) { keyAppendix = `["${k}"]` }
      else {
        //test if dot-notation works
        let value = { [k]: true };
        try { if (eval(`value.${k}`)) { keyAppendix = false } }
        catch (e) { keyAppendix = `["${k}"]` }
      }
      if (keyAppendix === false) { keyString = `${keyString ? keyString + '.' : ''}${k}` }
      else { keyString = `${keyString}${keyAppendix}` }
    }
    return keyString;
  }
}

const SPLIT_KEY_REGEX = /"(.+?)"|\d+|\w+/gm;
function splitKey(keyString = "") {
  if (Array.isArray(keyString)) { return new HierarchicKey(...keyString) }
  if (keyString.length == 0) { return new HierarchicKey() };
  let segments = keyString.match(SPLIT_KEY_REGEX)
    .map(seg => seg.startsWith('"') ? seg.substring(1, seg.length - 1) : seg);
  return new HierarchicKey(...segments);
}

/**
 * returns [HierarchicKey], one entry for each full path leading to a final none-object/none-array scalar
 */
function deepKeys(treeDict, prefix = '', visited = [], result = []) {
  let revisitIndex = visited.indexOf(treeDict)
  if (revisitIndex >= 0) { return result.push(`![${visited[revisitIndex + 1]}]`), result; }

  let value = treeDict.valueOf();
  if (typeof value == "object") {
    visited.push(treeDict, new HierarchicKey(...prefix));
    for (let k in value) {
      deepKeys(value[k], [...prefix, k], visited, result);
    }
    return result;
  }
  return result.push(new HierarchicKey(...prefix)), result;
}

class VisitedKey {
  constructor(stringKey) { this.key = stringKey }
  toString() { return this.key }
}
function deepImplode(data, prefix = '', visited = [], result = {}) {
  let revisitIndex = visited.indexOf(data)
  if (revisitIndex >= 0 && revisitIndex % 2 == 0) { return { [prefix]: `![${visited[revisitIndex + 1]}]` } }

  let value = data.valueOf();
  if (typeof value == "object") {
    visited.push(data, new VisitedKey(prefix));
    if (Object.keys(value).length == 0) {
      return result[prefix] = (Array.isArray(value) ? [] : {}), result;
    }
    for (let k in value) {
      let keyAppendix = false;
      if (k == parseInt(k).toString()) { keyAppendix = `[${k}]` }
      else if (k.includes('.') || k.includes('/')) { keyAppendix = `["${k}"]` }
      else {
        try { eval(`value.${k}`); }
        catch (e) { keyAppendix = `["${k}"]` }
      }
      let newPrefix = (keyAppendix === false ? (`${prefix ? prefix + '.' : ''}${k}`) : `${prefix}${keyAppendix}`);
      deepImplode(value[k], newPrefix, visited, result);
    }
    return result;
  }
  return result[prefix] = data, result;
}

function deepGet(obj, key, defaultValue, createMissing = false) {
  key = splitKey(key);

  let nested = obj;
  let section, nextSection;
  while (key.length > 0) {
    section = key.shift();
    nextSection = key[0] || false;
    let asIndex = parseInt(nextSection);
    if (0 <= asIndex && asIndex.toString() == nextSection) { nextSection = asIndex; }

    if (typeof nested[section] == "undefined") {
      if (typeof defaultValue != "undefined") { return defaultValue; }
      if (createMissing) { nested[section] = Number.isInteger(nextSection) ? [] : {}; }
      else { throw new Error(`No sub-path [${section}.${key.join('.')}] in given object and createMissing=false`) }
    }
    nested = nested[section];
  }

  return nested;
}

/** Assign given value at the subtree path designated by key
 * key can be a string in '.' hierarchy notation style or an array of string segments
 * when it is a string, only basic splitting on '.' is performed, so this does not
 * work well with keys containing dots itself.
 */
function deepAssign(obj, key, value) {
  key = splitKey(key);

  let nested = deepGet(obj, key.slice(0, key.length - 1), undefined, true);
  nested[key.pop()] = value;
  return obj;
}

/**
 * Performs a deep comparison of 2 objects.
 * Returns a deeply nested object structure which only contains those keys of obj2 NOT contained in obj1.
 * Arrays are not treated specially for the comparison. Every index is used as "key".
 * The diff structure will not contain arrays, but a diff object that contains all index-based key entries where the arrays differed.
 * which are NOT identical in obj1.
 * 
 * @example
 *   obj1: { test: {x:42, y:"abc", w:88}, arr:[4,5,6] }
 *   obj2: { test: {x:42, z:"abc", w:85}, arr:[4,8,6] }
 *   result: { test: {z:"abc", w:85}, arr: {"1": 8} }
 */
function diff(obj1, obj2) {
  const result = {};
  if (Object.is(obj1, obj2)) { return undefined; }

  if (!obj2 || typeof obj2 !== 'object') { return obj2; }

  Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})).forEach(key => {
    if (typeof obj2[key] === 'object' && typeof obj1[key] === 'object') {
      const value = diff(obj1[key], obj2[key]);
      if (!isEmpty(value)) { result[key] = value; }

    } else if (obj2[key] !== obj1[key] && !Object.is(obj1[key], obj2[key])) {
      result[key] = obj2[key];
    }
  });
  return result;
}

const ARR_MOD_PATTERN = /@[+-](.+)/
function isArrayModOp(current, updates, key) {
  let coreKey = ARR_MOD_PATTERN.exec(key);
  return coreKey != null
    && (Array.isArray(current[coreKey[1]]) || typeof current[coreKey[1]] == "undefined")
    && Array.isArray(updates[key])
}

function handleArrayModOp(current, updates, modKey) {
  let coreKey = modKey.substring(2);
  let modType = modKey.substring(0, 2);

  let base = current[coreKey];
  let changes = updates[modKey];
  //console.error("ARRAY MOD", modKey, modType, coreKey, base, changes)
  switch (modType) {
    case '@+':
      if (!Array.isArray(base)) { base = current[coreKey] = [] }
      changes.forEach(c => !base.find(e => e.valueOf() == c.valueOf()) ? base.push(c) : null); 
      break;
    case '@-':
      if (!Array.isArray(base)) { return }
      let allowed = base.filter(b => !changes.find(c => b.valueOf() == c.valueOf()));
      base.splice(0, base.length);
      base.push(...allowed);
      break;
  }
}
/**
 * Recursively merges object argument 2 (updates) into argument 1 (current).
 * Merge rules:
 * - 'updates' is treated as a 'diff'. Properties not found here are left untouched.
 *   Exception: substructures in current under a property that is empty in 'updates'
 * - Merge checks all properties returned by `Object.keys(updates)`.
 * - Arrays are currently treated identical to Objects/Dicts.
 *   => merge will recurse and overwrite/modify index-by-index.
 *   This means that arrays can not be replaced 'as a whole'.
 * - Any object graph substructure in updates that differs in type will overwrite the respective property in current.
 *   When both value types are identical (same constructor) and are of type 'object', mergeObjects recurses.
 * - Objects and sub-structures deemed empty by isEmpty() will instead be deleted from 'current'.
 */
function mergeObjects(current, updates, keepEmptyObjects = false) {
  if (typeof current != "object" || typeof updates != "object") { return current }

  for (let key of Object.keys(updates)) {
    if (updates.hasOwnProperty(key) && isEmpty(updates[key], !keepEmptyObjects)) {
      delete current[key];
    } else if (isArrayModOp(current, updates, key)) {
      //console.error("Detected array mod:", current, updates, key)
      handleArrayModOp(current, updates, key);
    } else if (isDefined(current[key], updates[key])
      && typeof updates[key] === 'object' && typeof current[key] === 'object'
      && updates[key].constructor == current[key].constructor) {

      mergeObjects(current[key], updates[key]);
    } else {
      current[key] = updates[key];
    }
  }
  return current;
}

function removeEmpty(value) {
  if (isEmpty(value)) { return null; }

  if (Array.isArray(value)) {
    let cleaned = [];
    value.forEach(entry => {
      let newEntryValue = removeEmpty(entry);
      if (newEntryValue != null) { cleaned.push(newEntryValue); }
    });
    value = cleaned;
  } else if (typeof value == 'object') {
    Object.keys(value).forEach(key => {
      let newValue = removeEmpty(value[key]);
      if (newValue == null) { delete value[key]; }
      else { value[key] = newValue; }
    });
  }
  if (isEmpty(value)) { return null; }
  else { return value; }
}

function isEmpty(value, checkObjectKeys = true) {
  if (typeof value == "undefined" || value == null) {
    return true;
  }
  let realValue = value.valueOf();
  if (realValue != value) { return isEmpty(realValue, checkObjectKeys) }

  if (Array.isArray(value) || typeof value == "string") {
    return value.length == 0;
  }

  if (typeof value == "object") {
    return checkObjectKeys && Object.keys(value).length == 0;
  }

  return Number.isNaN(value);
}

function isDefined(...values) {
  return values
    .filter(v => v != null)
    .filter(v => v != undefined)
    .length == values.length;
}

function tokenize(value, separator, limit = 0) {
  limit = Math.max(limit, 0);
  let tokens = [];
  let currentIndex;
  while ((currentIndex = value.indexOf(separator)) >= 0 && (tokens.length + 1) < limit) {
    tokens.push(value.substring(0, currentIndex));
    value = value.substring(currentIndex + separator.length);
  }
  if (value.length > 0) { tokens.push(value) }
  return tokens;
}

module.exports = {
  HierarchicKey, splitKey,
  mergeObjects, diff,
  removeEmpty, isEmpty,
  deepImplode, deepAssign, deepGet, deepKeys,
  tokenize
}
