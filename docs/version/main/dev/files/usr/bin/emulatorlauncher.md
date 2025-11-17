# /usr/bin/emulatorlauncher

# /usr/bin/emulatorlauncher

Central executable responsible for launching games

## Overview

The logic in this file grouped into several steps, most of which are internal implementation details.

These steps are:
1. Parse command line
2. Determine effective properties for the game
3. Configure [controls](../../dev/files/opt/emulatorlauncher/lib/.controls.lib.md)
4. Configure system/emulator
4. Execute additional [pre-game operations](emulatorlauncher-operations.md)
5. launch the game
6. post game events and clean-up

See developer documentation for all specifics


## Index

* [_preRunOperations](#_prerunoperations)
* [_postRunActions](#_postrunactions)
* [_fork](#_fork)
* [declare-ro](#declare-ro)
* [_sourceLib](#_sourcelib)

## _preRunOperations

In addition to the default preparation steps, there is a varying amount of additional steps that might have to be
taken before a game can be launched. This function encapsulates that.  
It will be called as the final step before launching a game, going over a list of commands that were registered as pre-run operations.
The list is an array named `_PRE_RUN_OPERATIONS`, where any sourced file can add entries to, if required.  
Operations passed to `emulatorlauncher` with the `--operationName` syntax will also be added here.

**Note:** When adding commands, be mindful of blanks. This function uses xargs/printf to retain quoted spaces.  
E.g. "some-command -opt 'file with blanks' will be handled as `[some-command] [-opt] [file with blanks]`

## _postRunActions

Some actions need to always be executed when `emulatorlauncher` exits or crashes.  
To do so, this function is registered as the main `EXIT` trap. When executed, it will loop over a well-known array of commands.  
The array is named `_POST_RUN_ACTIONS` and can also be added to from sourced functions or system runners.  

**Note:** When adding commands, be mindful of blanks. This function uses xargs/printf to retain quoted spaces.  
E.g. "some-command -opt 'file with blanks' will be handled as `[some-command] [-opt] [file with blanks]`

## _fork

This function is meant to be used with `_PRE_RUN_OPERATIONS` and `_POST_RUN_ACTIONS`.  
It is not possible to fork a new subprocess by suffixing '&' to a string entry of one of those arrays,
It will be interpreted as argument instead of shell feature.  
So, a function will be used as mapper instead, which will just pass through the command line prepend `&`

## declare-ro

emulatorlauncher needs a concept to prevent overriding of pre-defined variables.  
This is required for handling overrides received via command line when `effectiveProperties` are sourced later on.
To be more precise, what comes from the command line must have priority and be protected from being overridden later on. 
However, due to the way regular bash read-onlys work, the script would crash and fail when the same declaration is encountered again.  
`emulatorlauncher` stopping in that case is not desirable, the second assignment just should not have any effect.  
This is where this function comes into play. It provides generic, codified support for checking before setting a variable 
(or ignoring the second assignment otherwise).  
**It is only meant for variables which represent 'game properties'** - There is no need to use it for every internal bash variable.  

This function also adds the name of variables given to it into an array named `_declaredVars`.
This is mainly used for debugging and the operation `launchConfiguration` to distinguish 'game properties' from 'bash variables'.

Has two forms:
1. `declare-ro "name=value"`
2. `declare-ro -A "name"`

## _sourceLib

Helper function. Do some logging and source the given file.
Primarily meant to source private .lib files and will assume a given simple name to be such a library.
First checks the given file path itself for existence. In case a relative path is given,
this will be context-sensitive.
When no file can be found, certain well-known default locations will be prepended and checked for existence.


<sub>Generated with shdoc from [/usr/bin/emulatorlauncher](https://github.com/GB609/batocera-ES-onArch/blob/be9c539258e51cfc779109617be05d9500c8a0dc
/sources/fs-root/usr/bin/emulatorlauncher)</sub>