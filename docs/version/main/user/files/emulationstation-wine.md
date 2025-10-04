```
--- usage: ---
emulationstation-wine <action> <rom> [-cfg path/to/sourceable/wine/envconfig] [-- args for <effective executable>, also works for installation]

A re-implementation of batocera-wine which tries to keep the same API, in addition to new capabilities.
Flags that only exist for backwards-compatibility: 'play', '.w'tgz, '.w'squashfs, '.pc'
 * <action>: one of (run|play, install, import, config, tricks, explore, patch, cmd, mkAutorun)
 * run <rom>: path/to/rom[.wine|.pc|.(w)squashfs|.exe|.(w)tgz] - run directly
 * install <rom>: path/to/rom[.exe|.(w)tgz|.msi|.iso] - create prefix in library and guide through installation setup
 * import <rom>: path/to/rom.(w)tgz or directory - create prefix in library and copy content from given source. For zipped games without installers.
 * <effective executable>: value of ${CMD}, either provided by autorun.cmd in game folder or passed in config file.
 * <-cfg file>: a file that must be sourceable by bash containing wine/proton env variables.
	Can also be used to override values in autorun.cmd (if existing)
	when no -cfg is given, this script will request config from emulatorlauncher to assure necessary args are set up correctly

```
## Index

* [_setupPrefix](#setupprefix)

### _setupPrefix

Create wine prefix directory at location given.
Does not re-create the prefix if the file 'system.reg' already exists in the given directory.
Also exports given directory name as WINEPREFIX variable and calls _readWineAutorun as last step
If the WINE_DISC environment variable is set after _readWineAutorun, the disc image will be mounted

#### Arguments

* **$1** (directory): that should be initialised as prefix
* **$2** (-): optional. one of

