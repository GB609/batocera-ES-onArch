# /opt/emulatorlauncher/.value-transformations.lib

## Index

* [_join (internal)](#_join)

### _join

join multiple strings into one, separated by the first argument given
uses IFS internally, so it will only take the first character of $1 even when the string is longer

#### Arguments

* **$1** (character): to use as separator
* **$2** (..$n): strings to join

#### Output on stdout

* $2[$1$3][$1$4][...]


<sub>Generated with shdoc</sub>