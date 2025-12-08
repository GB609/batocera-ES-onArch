# /opt/emulatorlauncher/lib/.controls.lib

## Overview

When property `hide_mouse` is set and `unclutter` is installed:  
-> Add `_controls:startUnclutter` to `_PRE_RUN_OPERATIONS`

When executed:
-> fork out `unclutter`
-> add kill for unclutter's pid to `POST_RUN_ACTIONS`

## Index

* [_controls:sdl-filterDB](#_controlssdl-filterdb)
* [_controls:sdl-useExternal](#_controlssdl-useexternal)
* [`$sdl_config`](#sdl_config)
* [Configuration of antimicrox](#configuration-of-antimicrox)
  * [_controls:amx-userProfile](#_controlsamx-userprofile)
  * [_controls:amx-configure](#_controlsamx-configure)

## _controls:sdl-filterDB

Used to filter a `gamecontrollerdb.txt` according to the guids and names of controllers assigned to players.  
This is a utility function meant to be used from the logic setting up the SDL configuration.
1. Requires variables `p[1-8]guid` and `p[1-8]name`
2. Constructs a pattern in grep extended regex format out of them
3. runs grep against stdin

### Input on stdin

* `gamecontrollerdb.txt` format

### Output on stdout

* grep result

## _controls:sdl-useExternal

This function allows to use an external executable to retrieve SDL configuration strings.  
The expected executable name is `es-sdl` and it must be found on PATH.
`es-sdl` It will be called once per controller and the final concatenated result is printed to stdout.

### Output on stdout

* `gamecontrollerdb.txt` format

### See also

* [external SDL provider](MANUAL:user/files/external-sdl.md)

## `$sdl_config`

## Configuration of antimicrox

### See also

* [AntiMicroX](https://github.com/AntiMicroX/antimicrox)

### _controls:amx-userProfile

When the setting `controller_profile` has any game-, emulator- or system-specific value,
the corresponding profile is normally user-specific and thus part of user saves.  
This function assists in creating new profiles, to make sure they are in line with a certain set of required keybinds.  
**Reason:** To ensure that the `guide` button works uniformly across all apps and games (for os-wide intervention),
it has to be defined in ALL profiles in the same way.  
Thus, new profiles should be based on a template, OR be patched afterwards to correct misconfigurations done by the user.

#### Options

* (string) realm of user defined, one of `u-game`, `u-system`, `u-emu`

### _controls:amx-configure

This function will be called when the property `controller_profile` is set to any value other than `none`.  
It will evaluate the property value and try to locate the actual profile file. However, the profile will 
not be used as is, because we must ensure that the guide button works uniformly across all profiles.  
Therefore, a temporary profile will be created, by selectively merging the located target with the `GUIDE` profile:
1. Overwrite the `GUIDE` button in all profile sets with the one from GUIDE
2. Overwrite (or add) the last set (index 8) from the GUIDE profile to the base profile. This set contains 
the control definitions needed to navigate the OS menu.  
3. The resulting file will be cached in `ES_CACHE_DIR/controller-profiles/`
Before an existing file is re-created, a simple check based on modification times is done to make sure there is 
unnecessary re-processing that would not have an effect.

The merging is not done in bash. It is done by `btc-config applyGuideProfile`.


<sub>Generated with shdoc from [/opt/emulatorlauncher/lib/.controls.lib](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/emulatorlauncher/lib/.controls.lib)</sub>