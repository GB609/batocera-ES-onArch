# /opt/batocera-emulationstation/lib/user-paths.lib

Common definition of user-specific application paths.

## Overview

This file is sourced from multiple scripts to ensure that they all share the same common configuration when launching 
emulationstation or any game.  
It is required because almost any path used in the code can be adjusted and re-configured, both system-wide as well as
user-specific paths.    
The following definitions are made in this file:
- `XDG_*` - runtime, config, data, state, cache 
- `ES_DATA_DIR`, `ES_STATE_DIR`, `ES_CACHE_DIR`
- `ROMS_ROOT_DIR`
- `SAVES_ROOT_DIR`
- `TMP_DIR`  

...basically anything that will change with the user.  

All definitions are declared in a way that will not change or delete pre-existing settings:  
```
VARNAME=${VARNAME:-default}
```
Where `default` often is a sub-directory of another declared path / variable.

This file also contains a few functions/general purpose utilities which are used from multiple places.

## Index

* [_hasBin](#_hasbin)
* [_hasFunc](#_hasfunc)
* [_checkOutdated](#_checkoutdated)

## _hasBin

Small wrapper around which to prevent any output and make syntax more readable. For use in ifs.

## _hasFunc

Helper to create modular script libraries. Can be used to only declare a function when it has not been declared.
Modular script libraries are more compatible with tests by ShellTestRunner.  
Exits with 0 if the given function exists, 1 if not. This makes it possible to simply prefix function declarations
with `_hasFunc name || `.

### Example

```bash
  # Single line, no doc. Single lines are not correctly recognized by shdoc.
  _hasFunc 'name' || name() { 
     some command
  }
  # multiline with a function documented by shdoc
  _hasFunc 'funcName' || \
  # some documentionation
  # with multiple lines
  function funcName { ... }

```

## _checkOutdated

Generic check to see if a 'target' is older than the 'sources' it is produced from.  
This is a generic function which can be used in any context where one file is generated from input 
of at least one source file. In a lot of those situations, the input might not have changed at all, 
so there is no need to run the full generation process of the target file.  

This function exists to test for this situation. It works by doing a rudimentary check of the 
modification times of the arguments passed, with the first argument serving as the 'target/generated' file:
- When $1 is the most recent, return 1 - calling code would not have to recreate the file in question.
- When any of $2-$n is more recent, return 0 - recreation is necessary.

### Options

* $2-n file source file(s)

### Arguments

* **$1** (file): the target file


<sub>Generated with shdoc from [/opt/batocera-emulationstation/lib/user-paths.lib](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/batocera-emulationstation/lib/user-paths.lib)</sub>