# /opt/batocera-emulationstation/config.libs/parsing.js

## Overview

This file contains a set of very simple parsers providing just enough of the specs/grammars 
to handle the different property file languages and styles used in batocera.linux:
- es_systems.yml
- es_features.yml
- configgen-*.yml
- *.conf files
- *.cfg files
- *.json

Self-implemented to avoid a bigger dependency on npm and other, needlessly large node modules.

## Index

* [parseDict](#parsedict)
* [confToDict](#conftodict)
* [INTERNAL SUPPORT CLASSES AND FUNCTIONS](#internal-support-classes-and-functions)
* [class ParseStack](#class-parsestack)
* [endBlock](#endblock)
* [class PropValue](#class-propvalue)

## parseDict

This function is the main entrance to this file.  
It tries to auto-detect the parser function to use depending on the file type.  
The detection is rudimentary, it goes by extension. Concrete handler functions are looked up
in a constant object named `PARSE_FUNCTIONS`.

All handler functions follow the same contract:
- They will generally return nested object structures.
- Each actual property entry will we wrapped in an instance of `PropValue`.  

[**@exported**]

### See also

* [class PropValue](#class-propvalue)

## confToDict

Handles `*.conf` files like `batocera.conf`.  
Capable of unpacking batocera's special syntaxes into regular tree structures:
- system["<game-name>"].something=...
- system.folder["<folder-path>"].something=...

[**@exported**]

### See also

* [analyseProperty](#analyseproperty)

## INTERNAL SUPPORT CLASSES AND FUNCTIONS

Most of the classes and functions following this block are for parsing yml files
as this is the most complex format.

## class ParseStack

YAML FILES

## endBlock

return false if the current line is NOT processed by handler,
but only serves as terminator

## class PropValue

Helper class that can be used to transport meta-information about the origin of a property.
Most use cases shouldn't care because of the valueOf implementation and just behave as if it was a string.
One notable exception is default initialisation by existence checks.


<sub>Generated with shdoc from [/opt/batocera-emulationstation/config.libs/parsing.js](https://github.com/GB609/batocera-ES-onArch/blob/43d35632d374133388d9a9fc48adbfa77cd43120
/sources/fs-root/opt/batocera-emulationstation/config.libs/parsing.js)</sub>