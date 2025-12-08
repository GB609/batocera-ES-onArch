# /usr/bin/emulationstation-wine

# /usr/bin/emulationstation-wine

## Overview

wrapper script for handling of wine, reading batocera config files and handling all game file types

## Index

* [Handling of wine prefixes and saves](#handling-of-wine-prefixes-and-saves)
  * [_libraryPrefix](#_libraryprefix)
  * [_userPrefix](#_userprefix)
* [Supported Actions](#supported-actions)
  * [run](#run)
  * [install](#install)
  * [mkAutorun](#mkautorun)

## Handling of wine prefixes and saves

Dealing with wine for a (potentially) shared game library introduces 2 issues that have to be solved.
1. Save games: Wine is just an execution layer, it does not directly control how - and where - an application will save its data.
Applications don't do this in a uniform way. Save locations vary greatly, depending on the age of the game, targeted windows version
also the frameworks in use. Some save in the user's home, some in a direct subdirectory etc.
2. Wine enforces a certain file ownership policy. It normally is not possible to run the same prefix for 2 users.

emulationstation-wine will work around both limitations with the following approach:
1. There is a difference between a `libraryPrefix` and a `userPrefix`.
2. `libraryPrefix`: The game installations themselves, placed under the corresponding system's rom directory.
3. `userPrefix`: These are based on library prefixes, but use fuse and overlay mounts to create user-specific directory structures when starting a game. 

While the game runs, all of its writes go into the overlay. This overlay will be decoupled when it stops.
With that, it becomes possible to update/modify the library prefix without invalidating user saves in the overlay.

This approach has its limits and can fail when a file exists in both the library and the save and is modified differently in both.

### _libraryPrefix

This function is responsible for configuring an action that targets a library prefix
This normally only means to set `WINEPREFIX` to the game's directory under `ROMS_ROOT_DIR/system/...`.
1. Library prefixes can be owned by a shared user or group in a shared rom directory. 
In that case, this method has to make sure that any command is actually executed by the owner of the group.
Functions/commands that target library prefixes might need to ask for a user change or sudo privileges.
2. Library prefixes created by `emulationstation-wine install` will be isolated from the linux user's home directory.
This is an important measure the handle correct redirection and capturing of save games.
**Please do not directory create a library prefix manually without this step.**

**This is an internal function that can not be called from the outside. Mentioned for documentation reasons here**

### _userPrefix

This function sets up user prefixes from the given library rom prefix.
As mentioned above, these are overlay-fs constructs (going from lowest to highest):
1. lower 1: The library prefix
2. lower 2: (optional) DXVK
3. upper: The user's save directory for the game

After the game ended, the overlay fs will be deconstructed and the save directory converted back into a
'clean' directory structure without overlay fs meta informations.
This makes it possible to allow modifications to the library prefix again.

**This is an internal function that can not be called from the outside. Mentioned for documentation reasons here**

## Supported Actions

The following actions can be passed to emulationstation-wine.
All of these functions take the same argument line format:<br>
`emulationstation-wine <function-name> <path/to/rom> [-cfg path/to/sourceable/wine/envconfig] [-- args for real executable]"`
* `-cfg` is optional and usually an internal implementation detail
* `--` and anything following it is optional and will be passed to the real `*.exe` that will be launched at the end

However, these functions run against different targets (=WINEPREFIX), as explained in the section about prefixes.

### run

The main function: Start a game.  
Targes user prefix, derived from the given library rom path.

### install

Install a game. Asks a few questions to guide and improve automatic installation.
1. Creates a new library prefix from another library rom.
2. Installation source must be file/directory from the windows/windows_installers systems
3. Can handle setup exes, zip files, isos and plain copy

### mkAutorun

This is a guided utility that can be used to create `autorun.cmd` files for wine applications.  
Will automatically be started at the end of a new installation, but can also be triggered manually later on.
Targets library prefixes. 

If the `autorun.cmd` file shall be different for a user, it has to be patched manually.  
**Note:** When changed manually for a user, changes in the file within the library prefix will NOT propagate to that user anymore.


<sub>Generated with shdoc from [/usr/bin/emulationstation-wine](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/usr/bin/emulationstation-wine)</sub>