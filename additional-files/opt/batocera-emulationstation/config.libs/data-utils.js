class HierarchicKey extends Array {
  static #JOINED = Symbol.for('JK');
  constructor() { super(...arguments); }
  parent() { return new HierarchicKey(this.slice(0, this.length - 1)) }
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

function splitKey(keyString = "") {
  if (Array.isArray(keyString)) { return new HierarchicKey(...keyString) }

  if (keyString.length == 0) { return new HierarchicKey() };
  let segments = keyString.match(/"(.+?)"|\d+|\w+/gm)
    .map(seg => seg.startsWith('"') ? seg.substring(1, seg.length - 1) : seg);
  return new HierarchicKey(...segments);
}

/**
 * returns [HierarchicKey], one entry for each full path leading to a final none-object/none-array scalar
 */
function deepKeys(treeDict, prefix = '', visited = [], result = []) {
  let revisitIndex = visited.indexOf(treeDict)
  if (revisitIndex >= 0) { return result.push(`![${visited[revisitIndex + 1]}]`), result; }

  let value = data.valueOf();
  if (typeof data == "object") {
    visited.push(data, new HierarchicKey(...prefix));
    for (let k in value) {
      deepKeys(value[k], [...prefix, k], visited, result);
    }
    return result;
  }
  return result.push(new HierarchicKey(...prefix)), result;
}

function deepImplode(data, prefix = '', visited = [], result = {}) {
  let revisitIndex = visited.indexOf(data)
  if (revisitIndex >= 0) { return { [prefix]: `![${visited[revisitIndex + 1]}]` } }

  let value = data.valueOf();
  if (typeof data == "object") {
    visited.push(data, prefix);
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
  if (typeof key == "string") { key = splitKey(key); }

  let nested = deepGet(obj, key.slice(0, key.length - 1), undefined, true);
  nested[key.pop()] = value;
  return obj;
}

/**
 * Performs a deep comparison of 2 objects.
 * Returns a deeply nested object structure which only contains those keys of obj2.
 * Arrays are not treated specially for the comparison. Every index is used as "key".
 * The diff structure will not contain arrays, but a diff object that contains all index-based key entries where the arrays differed.
 * which are NOT identical in obj1.
 * Example:
 * obj1: { test: {x:42, y:"abc", w:88}, arr:[4,5,6] }
 * obj2: { test: {x:42, z:"abc", w:85}, arr:[4,8,6] }
 * result: { test: {z:"abc", w:85}, arr: {"1": 8} }
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

function mergeObjects(current, updates, keepEmptyObjects = false) {
  if(typeof current != "object" || typeof updates != "object") { return current }
  
  for (let key of Object.keys(updates)) {
    if (typeof updates[key] === 'object' && typeof current[key] === 'object'
      && updates[key].constructor == current[key].constructor) {

      mergeObjects(current[key], updates[key]);
    } else if (updates.hasOwnProperty(key) && isEmpty(updates[key], !keepEmptyObjects)) {
      delete current[key];
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

function isEmpty(value, checkObjectsKeys = true) {
  if (typeof value == "undefined" || value == null) {
    return true;
  }

  if (Array.isArray(value) || typeof value == "string") {
    return value.length == 0;
  }

  if (typeof value == "object") {
    return checkObjectKeys && Object.keys(value).length == 0;
  }

  return Number.isNaN(value);
}

module.exports = { HierarchicKey, mergeObjects, diff, removeEmpty, isEmpty, deepImplode, deepAssign, deepGet, splitKey }
