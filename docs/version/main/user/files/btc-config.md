# /opt/batocera-emulationstation/btc-config

```
*** btc-config ***
This is part of the none-batocera.linux replacements for emulatorLauncher.py and configgen.
The aim is to retain as much of the batocera-emulationstation OS integration and configurability as possible
while porting/taking over as little of batocera.linux's quirks/complexity as necessary.
Most of the commands supplied by btc-config should not have to be used by regular EmulationStation users,
they are intended for internal scripting and development debugging.

Possible commands:

  * -h | --help [command]*
  : Print this text. Add --full for detailed descriptions inlcuding all optional parameters.
    Can also take an optional list of command names as filter.
    Behaves as if --full was set when exactly one [command] is given.

  * btcPropDetails key[.subkey]*.lastkey[=value]
  : Print calculated location+value of a single imported property. Value is optional and can also be passed as second argument.

  * configureRomPaths
  : Create user-specific es_systems.cfg addition containing only adjusted rom paths for all known systems.

  * controller:applyGuide existing/file/path
  : Merges the inbuild 'GUIDE' AMX profile with profile given as argument. Optionally creates images for the result.

  * controller:createImages existing/file/path
  : Generate pictures for controller -> keyboard mapping profiles, based on default SDL button mappings.

  * convert --to plain|conf|sh|yml|json|xml|settings arg

  * effectiveGlobals get|set [key] [value|default]
  : get or set os-wide (=global) property. 'get' prints on stdout.

  * effectiveProperties path/to/rom
  : Main tool for emulatorlauncher to get configuration for a game.
    Prints the result to stdout [or --output-file] in the style given by --format (default "sh")

  * effectiveUserSettings full|diff
  : Used to maintain `es_settings.cfg` when starting/stopping EmulationStation.

  * generateGlobalConfig
  : Import configuration files from conf.d as system-wide configuration.

  * importBatoceraConfig configFile [configFile]*
  : Merge & import batocera.conf and configgen-*.yaml files. !No merge with previous imports!
```
<sub>(Directly retrieved from the executable's help function)</sub>  




<sub>Generated with shdoc from [/opt/batocera-emulationstation/btc-config](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/opt/batocera-emulationstation/btc-config)</sub>