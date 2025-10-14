# /opt/batocera-emulationstation/config.libs/data-utils.js

## Index

* [deepKeys](#deepkeys)
* [deepAssign](#deepassign)
* [diff](#diff)
* [mergeObjects](#mergeobjects)

## deepKeys

returns [HierarchicKey], one entry for each full path leading to a final none-object/none-array scalar

## deepAssign

Assign given value at the subtree path designated by key
key can be a string in '.' hierarchy notation style or an array of string segments
when it is a string, only basic splitting on '.' is performed, so this does not
work well with keys containing dots itself.

## diff

Performs a deep comparison of 2 objects.
Returns a deeply nested object structure which only contains those keys of obj2.
Arrays are not treated specially for the comparison. Every index is used as "key".
The diff structure will not contain arrays, but a diff object that contains all index-based key entries where the arrays differed.
which are NOT identical in obj1.
Example:
obj1: { test: {x:42, y:"abc", w:88}, arr:[4,5,6] }
obj2: { test: {x:42, z:"abc", w:85}, arr:[4,8,6] }
result: { test: {z:"abc", w:85}, arr: {"1": 8} }

## mergeObjects

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


<sub>Generated with shdoc from [/opt/batocera-emulationstation/config.libs/data-utils.js](https://github.com/GB609/batocera-ES-onArch/blob/43d35632d374133388d9a9fc48adbfa77cd43120
/sources/fs-root/opt/batocera-emulationstation/config.libs/data-utils.js)</sub>