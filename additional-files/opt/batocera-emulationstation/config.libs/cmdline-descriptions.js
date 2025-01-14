let api =  require("./cmdline-api.js");

const DESCRIPTIONS = {
  btcPropDetails : [
    'key[.subkey]*.lastkey=value', 'Print calculated location+value of a single imported property.',
    'Takes batocera.conf key syntax and prints it converted as [configFile key value] to stdout. Also handles system.folder["path"] and system["gamename"] syntax.'
  ],
  
  generate : [
    'systems|features -s path/to/source.yml -o path/to/output/dir', 'Convert source yml to xml/cfg file for ES.',
    'Creates either es_systems.cfg or es_features.cfg from the given source to the output directory.',
    'The given yml source files must match the structure from batocera.linux.'
  ],

  createUserSystemConfig : [
    'sourceEsSystems.cfg targetEsSystemFileName --romdir romDirRootPath',
    'Filter out not installed emulators and change path prefix "/userdata/roms" in source to "$romDirRootPath" (default: ~/ROMs)'
  ],

  importBatoceraConfig : [
    'configFile [configFile...]* [-o etcDir]',
    'Merge & import batocera.conf and configgen-*.yaml files. !No merge with previous imports!',
    'Creates config dirs [etcDir]/batocera-emulationstation and [etcDir]/emulatorlauncher from batocera.linux config files.',
    'Supports batocera.conf and configgen-default-*.yaml files.',
    'Merges and filters content for effective & supported settings. Expects keys to be in the format key[.subKey]*.lastSubKey',
    'The [.subkey]+ structures will be mapped to fs directory tree paths so that files named "key[/subKey]*.cfg" are generated that only contain lastSubKey entries as property names.',
    'This allows merging of game or folder specific property files with defaults simply by sourcing them in the right sequence.',
    'It also removes the syntactical/structural differences between batocera.conf and the yaml files.',
    '!!! This is a batch operation that overwrites previous imports - all desired config files must be passed at once !!!'
  ],

  '--help' : ['', 'Print this text. Add --full for detailed descriptions.']
}

var printHelp = api.action({'--full':0}, (options, ...functionList) => {
  console.log("This is part of the none-batocera.linux replacements for emulatorLauncher.py and configgen.\n"
    +"The aim is to retain as much of the batocera-emulationstation OS integration and configurability as possible\n"
    +"while porting/taking over as little of batocera.linux's quirks/complexity as necessary.\n"
    +"See git repo for Ark-Gamebox for more details.\n"
     );
  if(functionList.length == 0){
    console.log("Possible commands:\n");
    functionList = Object.keys(DESCRIPTIONS);
  }
    
  functionList.forEach(key => {
    if (!Object.hasOwn(DESCRIPTIONS, key)) return;
    
    let desc = DESCRIPTIONS[key];
    if(options['--full'] || false){
      console.log("  * %s %s\n\n  %s\n", key, desc[0], desc.slice(1).join('\n  '));
    } else {
      console.log("  * %s %s - %s\n", key, desc[0], desc[1]);
    }
  });
});

module.exports = {
  printHelp
}