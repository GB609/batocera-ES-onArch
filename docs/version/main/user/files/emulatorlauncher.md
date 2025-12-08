# /usr/bin/emulatorlauncher

```
--- Usage: ---
emulatorlauncher -rom <path/to/rom> [[-<propertyName> propertyOveride] ...] [[--<additionalOperation>] ...]

Starts the given game. Reads and merges all properties and configurations from batocera.conf, folder-based overrides and user overrides.
This is mainly called from 'emulationstation', but can also be used from the console for debugging and testing purposes.

Any simple property that appears in a system's configuration can be force-overriden by passing it the to emulatorlauncher.
Properties given this way with a value != 'AUTO|auto' will not be taken from any configuration file.
'Simple' properties are those with the form 'systemName.propertyName' or those that do not contain a dot at all.
'emulationstation' uses 'system', 'emulator', 'core'.

'additionalOperations' are special actions that can be used to enhance or control the output and behavior of emulatorlauncher.
They are mostly intended for debugging or internal purposes when interacting with some other launcher scripts.
Additional operations will be executed in the order given after emulatorlauncher has finished all preparation steps.
They are the last actions to be run before the actual any real action (modifying properties, notifiying listeners, launching) is taken.
Current operations are:
 * 'effectiveProperties': Prints the result of merging all property source files in shell-style.  
   For debugging only. emulatorlauncher normally sources this as code as one step of property calculation
 * 'launchConfiguration': Prints the launch command and all properties and configuration file (changes) that will be used to start the game
 * 'noRun': Just stop and exit. This is only useful in combination with 'effectiveProperties' or 'launchConfiguration'
```
<sub>(Directly retrieved from the executable's help function)</sub>  

Central executable responsible for launching games

## Overview

The logic in this file grouped into several steps, most of which are internal implementation details.

These steps are:
1. Parse command line
2. Determine and load effective properties for the game.
3. Configure [controls](../../dev/files/opt/emulatorlauncher/lib/.controls.lib.md)
4. Configure system/emulator
4. Execute additional [pre-game operations](emulatorlauncher-operations.md)
5. launch the game
6. post game events and clean-up

See developer documentation for all specifics

## Index

* [_fork](#_fork)

## _fork

This function is meant to be used with `_PRE_RUN_OPERATIONS` and `_POST_RUN_ACTIONS`.  
It is not possible to fork a new subprocess by suffixing '&' to a string entry of one of those arrays,
It will be interpreted as argument instead of shell feature.  
So, a function will be used as mapper instead, which will just pass through the command line prepend `&`


<sub>Generated with shdoc from [/usr/bin/emulatorlauncher](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/usr/bin/emulatorlauncher)</sub>