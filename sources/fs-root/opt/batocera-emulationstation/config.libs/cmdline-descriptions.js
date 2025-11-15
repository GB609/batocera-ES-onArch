let api = require("./cmdline-api.js");
const io = require('./logger.js').get()

function argSpecDict(data, key) {
  if (this != data) {
    return argSpecDict.bind(data, data);
  }

  if (!key) { return Object.keys(this) }
  if (!this[key.name]) { return }

  let spec = (typeof key.name == 'string')
    ? `${key.name} ${this[key.name]}`
    : this[key.name];
  if (!key.required) { spec = `[${spec}]` }
  return spec;
}

const DESCRIPTIONS = {
  btcPropDetails: {
    brief: 'Print calculated location+value of a single imported property. Value is optional and can also be passed as second argument.',
    fullSpec: 'Takes batocera.conf key syntax and prints it converted as [configFile key value] to stdout. Also handles system.folder["path"] and system["gamename"] syntax.',
    argSpec: () => 'key[.subkey]*.lastkey[=value]'
  },

  configureRomPaths: {
    brief: 'Create user-specific es_systems.cfg addition containing only adjusted rom paths for all known systems.',
    fullSpec: [
      `This command is mainly intended to be used from the 'emulationstation' wrapper script.
Accepts desired ROMs root directory either as environment variable 'ROMS_ROOT_DIR' or by using '--romdir'
Systems are pulled from the locations given via CONFIG_HOME (system-wide) and HOME (user-specific)
Both can be given either as environment variable or via '--config-home'/'--home' respectively.
Command line arguments take priority.`
    ],
    argSpec: argSpecDict({
      '--comment': '"file-comment"'
    })
  },

  'controller:applyGuide': {
    brief: `Merges the inbuild 'GUIDE' AMX profile with profile given as argument. Optionally creates images for the result.`,
    fullSpec: `Used by 'emulatorlauncher' when the controller profile feature is set to any profile.
This command is used to retain consistency of how the guide button works to assure that the basic functionality will work with every profile.
Alternative options would require to burden profile creators with conventions or somehow document that certain parts of prepared templates
shall not be changed. This is prone to errors and could potentially brick the system to require a restart via power button when no keyboard is used.

The command can also additionally create SVG images for the profile, as done by 'controller:createImages', when any of the '--svg' options is given.
This option is embedded here to improve performance as the '.amgp' doesn't have to be parsed twice when both is done at once. 
'--svg' is just a convenience flag to enable image creation with the regular defaults for --target-dir and --name-prefix.
'--svg-target-dir' and '--svg-name-prefix' are passed to 'controller:createImages' as '--target-dir' and '--name-prefix' respectively.`
  },
  'controller:createImages': {
    brief: 'Generate pictures for controller -> keyboard mapping profiles, based on default SDL button mappings.',
    fullSpec:
      `This command takes one AntiMicroX '.amgp' file as input argument and generates multiple SVG files from its content.
One SVG will be created per set/group of the profile. It is normally called from the logic flow within 'emulatorlauncher'.
The images' names will be a combination of the profile and group names plus a number to indicate sorting order for display.
By default, the images go into $XDG_RUNTIME_DIR, but this can be changed with '--target-dir'.
It's also possible to change the resulting image names with '--name-prefix'.

This command understands a subset of actions in amgp files and maps them to human-readable descriptions:
 - Simple keypress actions of any character and most control/meta keys
 - mousemovement
 - mouse buttons 1-7
 - set changes
 - Manually assigned action names in AMX. This is the preferred way to label complex keybinds.

The labels will be placed on a templated XBOX controller, at the positions where the matching SDL button would be.
At the moment, it does not detect if buttons are swapped by using a different SDL configuration/button mapping.`
  },

  effectiveGlobals : {
    brief: `get or set os-wide (=global) property. 'get' prints on stdout.`,
    fullSpec:
      `'os-wide' properties are config values which are not specific to any emulator or rom 'system'. These are used outside of emulatorlauncher, for controlling system behavior.
  examples: audio.volume, wifi.enabled, bluetooth.enabled, global.resolution

Properties are searched by merging the following files in the order given:
  1. $BTC_CONFIG_ROOT/system.conf
  2. $ES_CONFIG_HOME/es_settings.cfg
The merge follows the same basic overwriting logic as 'effectiveProperties', except emulator/game/folder-specific properties aren't resolved.

'get' has 2 basic modes of operation:
  1. When 'key' is a clearly identified, unique property: print its value or an optional default which was passed as second arg.
  2. Without any 'key', or when key is not pointing to a full property key:
     Print a list of matching properties in [--format=conf], filtered by [--filter]. [--strip-prefix] customizes the 'sh' format. 
     When no '--filter' is given, but 'key' is, 'key' effectively works as regex filter.
     Otherwise '--filter' takes either a regex or a path to a propery file.
     When a file is given, the printed value list will only contains contained in the same root nodes as those in the filter file.
     [value] is ignored in this mode.
Mode 2 is useful in situations where multiple values from the same root key are needed at once. It improves performance and reduces code.
  
'set' requires key and value and must be run as root.
It modifies $BTC_CONFIG_ROOT/system.conf. As this is a generated file, 'set' also maintains a dropin file for the changes to remain.
Setting properties in es_settings.cfg is currently not supported because a running instance of 'emulationstation' might hold a cached 
version of it and overwrite any changes done to the file from outside.`,
  },

  effectiveProperties: {
    brief: 'Main tool for emulatorlauncher to get configuration for a game.\nPrints the result to stdout in the style given by --format',
    fullSpec:
      `This command calculates and provides all properties which are effectively set for a game.
'effectiveProperties' is the central piece of the interface between emulationstation and emulatorlauncher.
It parses multiple config files and merge related properties in a special way. Some files are always checked,
others depends on the system and game in question. Later files overwrite preceding values:
 1. $BTC_CONFIG_ROOT/emulators.conf
 2. <romSystemFolder>/**/folder.conf along the relative path of the rom.
 3. <romPath>/folder.conf - for directory-based roms
 4. <romPath>.conf - for all. Difference to 3: '.conf' file is sibling of rom
 5. $ES_CONFIG_HOME/es_settings.cfg

Regular batocera.conf syntax is supported.
All properties are collected first, according to the literal key path specified in the files.
Afterwards, folder and game specific properties are resolved and overwrite generic values:
 1. Any system.folder["path"].property will be stripped of the 'folder["path"]' and then overwrite the corresponding generic value.
 2. Then the same is done for any system["game-name"].property, potentially overwriting already-merged folder-specific values.

All '*.conf' files except 'emulators.conf' are effectively considered game/folder specific based on their location,
so using the batocera-style specification is redundant in simple cases. It is supported, however, and can be used to control merge order.
However, it is recommended not to use the batocera folder and game specific syntaxes. The 'folder.conf' concept was introduced to streamline folder/game specific property handling.

**Example:**
ROM: 'n64/racing/mariokart.n64'
in 'emulators.conf': 'n64.folder["racing"].prop=something'
- effectively identical to 'n64/racing/folder.conf' containing 'n64.prop=something'
=> 'folder.conf' would be applied first in case both are in use at once, because '.folder[]' properties are merged later.

- 'n64/racing/folder.conf' containing 'n64.folder["racing"].prop=another_thing'
=> Since 'folder.conf' uses the same property realm, merge order is retained as specified above: result would be 'n64.prop=another_thing'`
  },

  generateGlobalConfig: {
    brief: 'Import configuration files from conf.d as system-wide configuration.',
    fullSpec:
      `This command will generate the system-wide 'es_systems.cfg', 'es_features.cfg' and a series of emulator property files.
It's mainly used during PKGBUILD, install or update of the package, but can also be used to apply manual additions.
Requires root because files are written to /etc and /opt.
Process:
 1. Read and merge files from  $DROPIN_PATH/type/*
 2. Write results to $BTC_CONFIG_ROOT and $BTC_BIN_DIR
 3. known types are "features", "properties" and "systems"
 4. 'es_systems.cfg' and 'es_features.cfg' go into $BTC_BIN_DIR
 5. 'system.conf', 'emulators.conf' and a handful of 'supported_*.json' go into $BTC_CONFIG_ROOT

For performance and speed reasons, this command tries to be clever about what to re-create. It compares the modification times of source files against result files.
If any modification time is newer than that of the generated file, it will be re-created. Use '--force' to override this behaviour.`
  },

  importBatoceraConfig: {
    brief: 'Merge & import batocera.conf and configgen-*.yaml files. !No merge with previous imports!',
    fullSpec:
      `Creates config dirs [etcDir]/batocera-emulationstation and [etcDir]/emulatorlauncher from batocera.linux config files.
Supports batocera.conf and configgen-default-*.yaml files.
Merges and filters content for effective & supported settings. Expects keys to be in the format key[.subKey]*.lastSubKey
The [.subkey]+ structures will be mapped to fs directory tree paths so that files named "key[/subKey]*.cfg" are generated that only contain lastSubKey entries as property names.
This allows merging of game or folder specific property files with defaults simply by sourcing them in the right sequence.
It also removes the syntactical/structural differences between batocera.conf and the yaml files.
!!! This is a batch operation that overwrites previous imports - all desired config files must be passed at once !!!`,
    argSpec: argSpecDict({
      '-o': 'target-dir',
      '--comment': '"file-comment"',
      1: 'configFile [configFile]*'
    })
  },


  '--help': {
    brief: 'Print this text. Add --full for detailed descriptions.\nCan also take an optional list of command names as filter.',
    fullSpec: '--missing is intended for development debugging.',
    argSpec: argSpecDict({
      1: '[command]*'
    })
  }
}
DESCRIPTIONS['-h'] = DESCRIPTIONS["--help"];

var printHelp = api.action({ '--full': 0, '--missing': 0, 1: 1 }, (options, ...functionList) => {
  if (options['--missing']) {
    io.userOnly('Commands without detailed descriptions:');
    functionList = Object.keys(API).sort();
    io.userOnly(functionList.filter(f => !DESCRIPTIONS[f]).map(f => '  * ' + f).join('\n'));
    return;
  }

  if (functionList.length == 0) {
    io.userOnly(`This is part of the none-batocera.linux replacements for emulatorLauncher.py and configgen.
The aim is to retain as much of the batocera-emulationstation OS integration and configurability as possible
while porting/taking over as little of batocera.linux's quirks/complexity as necessary.
See git repo for Ark-Gamebox for more details.\n`);
    io.userOnly("Possible commands:");
    functionList = Object.keys(API).sort();
  } else if (functionList.length == 1) {
    options['--full'] = true;
  }

  functionList.forEach(key => {
    if (!Object.hasOwn(API, key)) return;
    let docGenerator = API[key].description;
    if (!docGenerator) {
      let desc = DESCRIPTIONS[key] || ['', '?'];
      io.userOnly("  * %s %s - %s", key, desc[0], 'UNSPEC');
    } else {
      let details = DESCRIPTIONS[key] || '';
      docGenerator(key, options['--full'] || false, details);
    }
  });
}, DESCRIPTIONS["--help"][1]);

module.exports = {
  printHelp
}
