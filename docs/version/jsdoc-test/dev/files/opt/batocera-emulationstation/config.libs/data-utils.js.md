# /opt/batocera-emulationstation/config.libs/data-utils.js

## Index

* [deepKeys](#deepkeys)
* [deepAssign](#deepassign)
* [diff](#diff)
* [mergeObjects](#mergeobjects)

### deepKeys

returns [HierarchicKey], one entry for each full path leading to a final none-object/none-array scalar

### deepAssign

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

class VisitedKey{
constructor(stringKey){ this.key = stringKey }
toString() { return this.key }
}
function deepImplode(data, prefix = '', visited = [], result = {}) {
let revisitIndex = visited.indexOf(data)
if (revisitIndex >= 0 && revisitIndex % 2 == 0) { return { [prefix]: `![${visited[revisitIndex + 1]}]` } }

let value = data.valueOf();
if (typeof value == "object") {
visited.push(data, new VisitedKey(prefix));
if(Object.keys(value).length == 0){
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
key can be a string in '.' hierarchy notation style or an array of string segments
when it is a string, only basic splitting on '.' is performed, so this does not
work well with keys containing dots itself.

### diff

if (typeof key == "string") { key = splitKey(key); }

let nested = deepGet(obj, key.slice(0, key.length - 1), undefined, true);
nested[key.pop()] = value;
return obj;
}

/**
Performs a deep comparison of 2 objects.
Returns a deeply nested object structure which only contains those keys of obj2.
Arrays are not treated specially for the comparison. Every index is used as "key".
The diff structure will not contain arrays, but a diff object that contains all index-based key entries where the arrays differed.
which are NOT identical in obj1.
Example:
obj1: { test: {x:42, y:"abc", w:88}, arr:[4,5,6] }
obj2: { test: {x:42, z:"abc", w:85}, arr:[4,8,6] }
result: { test: {z:"abc", w:85}, arr: {"1": 8} }

### mergeObjects

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

/**
Recursively merges object argument 2 (updates) into argument 1 (current).
Merge rules:
- 'updates' is treated as a 'diff'. Properties not found here are left untouched.
Exception: substructures in current under a property that is empty in 'updates'
- Merge checks all properties returned by `Object.keys(updates)`.
- Arrays are currently treated identical to Objects/Dicts.
=> merge will recurse and overwrite/modify index-by-index.
This means that arrays can not be replaced 'as a whole'.
- Any object graph substructure in updates that differs in type will overwrite the respective property in current.
When both value types are identical (same constructor) and are of type 'object', mergeObjects recurses.
- Objects and sub-structures deemed empty by isEmpty() will instead be deleted from 'current'.

TODO: implement support for merge/replace operations?


<sub>Generated with shdoc</sub>