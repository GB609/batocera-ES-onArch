# /opt/batocera-emulationstation/config.libs/config-import.js

## Index

* [mergePropertyFiles](#mergepropertyfiles)
* [sortDefinitions](#sortdefinitions)
* [toString](#tostring)

## mergePropertyFiles

Simple merge of several property files. Merges them in the order given in `files[]`.  
Known options:
- `ignoreInvalid`: [true|false] - Whether files that don't exists should be ignored or not
- `preMergeAction`: [function] - Allows for transformation of a parsed file's content before merging.
Called once per file, with the file's root object as argument. Expected to return (transformed) object.

## sortDefinitions

sort entries of buttonDef[] to the iteration order of BTC_TO_SDL to make comparison easier

## toString

Generates an SDL string


<sub>Generated with shdoc from [/opt/batocera-emulationstation/config.libs/config-import.js](https://github.com/GB609/batocera-ES-onArch/blob/2fcdc6d5cce3a8de9711781c90aee9a9d66303c9
/sources/fs-root/opt/batocera-emulationstation/config.libs/config-import.js)</sub>