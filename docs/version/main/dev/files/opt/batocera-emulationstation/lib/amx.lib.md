# /opt/batocera-emulationstation/lib/amx.lib

## Overview

This file provides some basic utility methods needed for uniform control of AntiMicroX. 
Because it only contains function definitions, it should be sourced. By default, functions contained
are not exported, but will be if `export` is given as first argument when sourcing.  
AMX is not just used for keybindings for games that don't support controllers.
It will also run when `batocera-emulationstation` is active, but with a minimal profile
whose sole responsibility is to handle the `guide` button of the controller.  
Therefore, basic start, stop and profile change functions are separate from `emulatorlauncher` 
because they are also needed from the `emulationstation` wrapper script for OS-level integration.  
requires:
- `logging.lib`
- `$CONFIG_ROOT`
- `$XDG_RUNTIME_DIR`
- `$ES_CACHE_DIR`

For better test support: function declaration and export is dynamic - the script will check for each function
if it is declared already and skip re-declaring when not.

## Index

* [_amx:pid](#_amxpid)
* [_amx:applyGuide](#_amxapplyguide)
* [_amx:restart](#_amxrestart)
* [_amx:guideMode](#_amxguidemode)
* [_amx:activateMenuGroup](#_amxactivatemenugroup)
* [_amx:checkOutdated](#_amxcheckoutdated)

## _amx:pid

`emulatorlauncher` has to keep track of the PID of AntiMicroX instances it has started. 
This function wraps the logic needed for that.
- When no arg given: stdout current value
- when numeric arg given: set/save as new PID

## _amx:applyGuide

The profile passed to this function will be 'merged' with the GUIDE profile in a special way
and the result will be cached.
Checks if the merge is necessary at all, or if there exists an up-to-date pre-cached file already.

### Arguments

* **$1** (file): path to `.amgp` file
* **$2** (player): number specifier

### Output on stdout

* assoc with keys 'profile' and 'imgDir', in the format of `declare -p`

## _amx:restart

Make sure that AntiMicroX get's fully shut down and restarted again before the game.  
**Reasons:** 
1. It's also based on SDL, as such it must use the mappings as they are provided by batocera for consistency (if there are any).  
But to achieve that, the `SDL_GAMECONTROLLERCONFIG` variable must be set when AMX launches.  
Any arguments passed to this function will just be forwarded to AMX.
2. AMX supports extended arguments, like `--startSet` which are meant to only change the active set of a controller.  
However, even these arguments don't work when AMX is running already. It has to be restarted and the profile must be passed again.  

That means: To make sure AMX behaves as expected in terms of loading profiles and sets, it always has to be force-restarted.  
The force-restart is taken care of in another core function, `_amx:exec`. The function `_amx:restart` is meant to prepare state data,
like images and a marker of the current profile, so that restarts which just want to change the set, have something to work with.

This function also tries to find - or generate - controller mapping files for all profiles passed to amx

## _amx:guideMode

This function 'resets' the controller profile used back to default.  
The default is a special profile called `GUIDE`, which is always active, even outside games.  
It contains only one button mapping in the first set: the `guide` button. This button will do 2 things when pressed:
1. shift to a secondary set which emulates keyboard buttons for menu navigation
2. press the `SUPER_L` button (or manually call some menu-displaying command)
3. The menu must shift back the control set when closing (not implemented yet).

## _amx:activateMenuGroup

Changes the currently active profile to set 8, which is always assumed to be GUIDE menu navigation.  
Works only for the first connected controller at the moment, no changes to others.  
This function has to fully restart AMX and pass in the active profile in addition, so it is a relatively expensive operation.  
The profile passed to AMX is `$XDG_RUNTIME_DIR/amx_profile_p1`, as prepared by `_amx:restart`

## _amx:checkOutdated

Because controller profiles in use are re-created dynamically, the mappings can also change, 
which means that the corresponding SVG images would have to be re-created as well.  
These are expensive operations and should only be performed when necessary, instead of
whenever a game is launched/profile is changed.

That is why the profiles and images will be cached. But this requires a way to find out if
recreation is necessary (cache is outdated). This function will do this.  
Internally, it depends on the generic function `_checkOutdated`. This function primarily exists to
document the specific of how controller profiles are handled.

### Options

* $2-n file source file(s)

### Arguments

* **$1** (file): the target file


<sub>Generated with shdoc from [/opt/batocera-emulationstation/lib/amx.lib](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/batocera-emulationstation/lib/amx.lib)</sub>