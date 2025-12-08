# /opt/emulatorlauncher/lib/.value-transformations.lib

## Index

* [_join](#_join)
* [_gamepadArgsToFilterDefinitions](#_gamepadargstofilterdefinitions)

## _join

join multiple strings into one, separated by the first argument given
uses IFS internally, so it will only take the first character of $1 even when the string is longer

### Arguments

* **$1** (character): to use as separator
* **$2** (..$n): strings to join

### Output on stdout

* $2[$1$3][$1$4][...]

## _gamepadArgsToFilterDefinitions

Iterates over variables named p{1..8}guid and p{1..8}name.  
Constructs an array of filter parameters as can be passed to `btc-config effectiveProperties` 
to retrieve SDL mappings for the given search strings.  
At least guid for a controller must exist, names will default to `.*` if not given.

usage: source <(_gamepadArgsToFilterDefinitions)

_Function has no arguments._

### Output on stdout

* `declare -p _gamepadFilters=('guid:deviceName'{0..n})`


<sub>Generated with shdoc from [/opt/emulatorlauncher/lib/.value-transformations.lib](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/emulatorlauncher/lib/.value-transformations.lib)</sub>