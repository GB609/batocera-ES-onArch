# Emulatorlauncher Operations

# .operations.lib

## Overview

This file contains detailed descriptions of additional actions that `emulatorlauncher` is able to do.  
These actions are called `operations` and can be passed to `emulatorlauncher` by prefixing the names given below with `--`.  
Most of the operations are intended for internal usage of system runner implementations interacting with `emulatorlauncher`.
However, some might be useful in debugging context or for user-provided scripts, which is why they are documented here.

## Example

```bash
`emulatorlauncher -rom path/to/game --locateExecutable psx`
```

## Index

* [locateExecutable](#locateexecutable)
* [effectiveProperties](#effectiveproperties)
* [noRun](#norun)
* [notifyListener](#notifylistener)

## locateExecutable

Uses es_find_paths.xml to search for an executable matching the given search pattern.  
Mostly required for internal usage by system executor files to allow flexibility in runner installation 
locations and package types (native, AppImage, etc.).  
Defined as a public operation for debugging purposes or usage with custom external scripts.

### Arguments

* **$1** (string): name, or part of the name of the executable to find

## effectiveProperties

Create a sourceable string of bash property declarations.
Assumes variables named `system` and `rom` to be in the environment.  
The path to a rom could alternatively also be supplied as `$1` directly.
However, this makes no difference when this operation is called from within `emulatorlauncher` as 
the launcher itself requires a rom argument already and just passes that on by setting context variables.

`effectiveProperties` is mostly meant for internal usage, 
although it is possible to use it as a operation for debugging or testing situations.  
This function internally calls `btc-config effectiveProperties` which does all the heavy lifting.

Format:  

```
declare-ro 'simpleProp=value'
declare-ro -A arrayName
arrayName['key']='value'
```

## noRun

By default, all additional operations to **not** prevent launch of the game.  
This 'pseudo' operation is meant to do that instead. When it is encountered, `emulatorlauncher` will just stop its current execution.  
Therefore, please make sure to use `--noRun` last if you intend to not start the game but only do some optional other operations.

## notifyListener

Calls the 'batocera' event script mechanism which is additional to what emulationstation provides.  
This will normally be done by `emulatorlauncher`, but can also be triggered externally with this operation.  
Detailed arguments can be found in the [Batocera Wiki](https://wiki.batocera.org/launch_a_script#watch_for_a_game_start_stop_event).  

usage: `emulatorlauncher -rom path/to/rom -- notifyListener gameStart|gameStop`


<sub>Generated with shdoc from [/opt/emulatorlauncher/lib/.operations.lib](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/emulatorlauncher/lib/.operations.lib)</sub>