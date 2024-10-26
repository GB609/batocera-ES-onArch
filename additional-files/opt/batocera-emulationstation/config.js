#!/usr/bin/node

const fs = require('fs');
const { execSync } = require('child_process');
const API = {};

const FOLDER_SPEC = /^\w+(\.folder\["(.*)"\]).*=.*/;
const GAME_SPEC = /^\w+\["(.*?)"\].*/;
const YAML_LINE = /^(\s*)([\w-\+]+)\:\s*(.*)/;
//const COMMENT_PREFIX = /^\s*(#+).*/;

const sysPropRootKeys = []
const supportedEmulatorRootKeys = []

API.btcPropDetails = function(propLine) {
	if (propLine.startsWith('##')) { return { comment: true, text: propLine } }
	if (!propLine.includes("=")) return false;

	let fspath, key, value, comment;
	if (propLine.startsWith('#')) {
		comment = '#'
		propLine = propLine.replace(comment, '')
	}

	if (fspath = FOLDER_SPEC.exec(propLine)) {
		propLine = propLine.replace(fspath[1], '');
		fspath = fspath[2].replace(/^\/userdata\/roms\//, '');
		console.error('after folder removal:', propLine);
	} else if (fspath = GAME_SPEC.exec(propLine)) {
		fspath = fspath[1];
		propLine = propLine.replace(`["${fspath}"]`, '');
		console.error('after game removal:', propLine);
	}

	propLine = propLine.replace(/\./g, '/');
	key = propLine.substring(0, propLine.indexOf('='));

	//key with blanks (folder and game are removed already here, these can contain blanks)
	if (key.includes(' ')) { return false; }

	key = key.split('/');
	if (fspath) {
		fspath = fspath.split('/');
		let idx = fspath.indexOf(key[0]);
		if (idx >= 0) { fspath = fspath.slice(idx + 1); }
		key = [key.shift(), ...fspath, ...key];
	}
	fspath = key.slice(0, key.length - 1);
	key = key.pop();
	value = propLine.substring(propLine.indexOf('=') + 1, propLine.length);

	fspath = fspath.join('/') + '.cfg';

	console.log(`'${fspath}'`, (comment != null ? comment : '') + key, `'${value}'`);

	return {
		file: fspath,
		key: key,
		value: value,
		commented: comment != null && comment.length > 0
	};
}
API.btcPropDetails.description = [
	'key[.subkey]*.lastkey=value', 'Print calculated location+value of a single imported property.',
	'Takes batocera.conf key syntax and prints it converted as [configFile key value] to stdout. Also handles system.folder["path"] and system["gamename"] syntax.'
];

async function readTextPropertyFile(confFile, lineParserCallback) {
	console.error('BEGIN READ: %s:', confFile);
	
	let properties = [];
	let comments = [];
	let lineReader = require('readline').createInterface({
		input: require('fs').createReadStream(confFile),
		crlfDelay: Infinity,
		terminal: false
	});

	let handler = lineParserCallback.bind(this, properties, comments);
	for await (let line of lineReader) { handler(line); }
 
	console.error("END READ: %s", confFile);
	return properties;
}

function parseConfLine(properties = [], comments = [], line) {
	line = API.btcPropDetails(line);
	if (line && !line.text) {
		properties.push(line);
		if (comments.length > 0) {
			line.comments = comments;
			comments = [];
		}
	}
	else if (typeof line == 'object') comments.push(line.text);
}

/**
 * Extremely rudimentary yml syntax parser to implode nested keys with simple values into
 * a flat property list, withs subkeys denoted with .sub
 * implemented by myself because the js-yaml package from extra in arch doesnt autoinstall as pacman package,
 * i'd have to manually fetch and makepkg it
 */
function parseYamlLine(state = {}, properties = [], comments = [], line) {
	let ymlLine = YAML_LINE.exec(line);
	if (ymlLine == null) {
		console.error('skip line [%s]', line);
		return;
	}
	let whitespace = ymlLine[1].length || 0;
	let key = ymlLine[2];
	let value = ymlLine[3];
	if (whitespace <= state.depth) {
		let popNum = Math.ceil((state.depth - whitespace) / state.stepWidth) + 1;
		if(popNum > 0) state.prefix.splice(-popNum);
		state.depth = whitespace;
	}

	if (line.endsWith(':') && whitespace >= state.depth) {
		if(key == 'options') state.prefix.push(null);
		else state.prefix.push(key);

		if (whitespace != state.depth) {
			state.stepWidth = whitespace - state.depth;
		}
		state.depth = whitespace;
	} else if (value != null && value.length > 0) {
		properties.push(API.btcPropDetails(state.prefix.filter(k => k!=null).join('.') + `.${key}=${value}`));
	}

}

API.createUserSystemConfig = function(sourceFile, targetFile, romDirOption, romDirPath){
	const EMU_REGEX = /<emulator\s+name="(.+)".*>/;
	const CORE_REGEX = /<core.*?>(.+?)<\/core>/;
	function filterEmusAndCores(entry){
		return EMU_REGEX.test(entry) || CORE_REGEX.test(entry);
	}

	let xmlSource = fs.readFileSync(sourceFile, "UTF-8");
	
	if(romDirPath.endsWith('/')) romDirPath = romDirPath.substring(0, romDirPath.length - 1);
	xmlSource = xmlSource.replaceAll('/userdata/roms', romDirPath);
  //why should emulatorlauncher have to search the emulator/core by itself?
  xmlSource = xmlSource.replaceAll('</command>', ' -emulator %EMULATOR% -core %CORE%</command>');
	
	/* TODO: find a way to detect installed emulators and disable/comment not installed
	* maybe i can leverage the es_find_rules.xml from ES-DE
	* or i'm just going to use simple 'which' calls and leave it up to the user
	* to get the emulator into PATH
	*/
	xmlSource = xmlSource.split('\n');
	console.log(xmlSource);
	
	console.log(xmlSource.filter( filterEmusAndCores));
}
API.createUserSystemConfig.description = [
	'sourceEsSystems.cfg targetEsSystemFileName --romdir romDirRootPath',
	'Filter out not installed emulators and change path prefix "/userdata/roms" in source to "$romDirRootPath" (default: ~/ROMs)'
]

API.importBatoceraConfig = async function(...files) {
	let properties = [];
	for (confFile of files) {
		if (confFile.endsWith('.yaml') || confFile.endsWith('.yml')) {
			let state = { prefix: [], depth: 0 }
			properties.push(...(await readTextPropertyFile(confFile, parseYamlLine.bind(this, state))));
		} else {
			properties.push(...(await readTextPropertyFile(confFile, parseConfLine)));
		}
	}

	let byFile = {};
	for(prop of properties){
		let dict = byFile[prop.file] || (byFile[prop.file] = {});
		let previous = dict[prop.key];
		prop.comments = [...(previous.comments || []), ...(prop.comments || [])];
		dict[prop.key] = prop;
	}
	//console.log(properties);
}
API.importBatoceraConfig.description = [
	'configFile [configFile...]* [-o outputDir]',
	'Merge & import batocera.conf and configgen-*.yaml files. !No merge with previous imports!',
	'Creates configuration dir content under [outputDir] from batocera.linux config files. Supports batocera.conf and configgen-default-*.yaml files.',
	'Merges and filters content for effective & supported settings. Expects keys to be in the format key[.subKey]*.lastSubKey',
	'The [.subkey]+ structures will be mapped to fs directory tree paths so that files named "key[/subKey]*.cfg" are generated that only contain lastSubKey entries as property names.',
	'This allows merging of game or folder specific property files with defaults simply by sourcing them in the right sequence.',
	'It also removes the syntactical/structural differences between batocera.conf and the yaml files.',
	'!!! This is a batch operation that overwrites previous imports - all desired config files must be passed at once !!!'
];

API['-h'] = API['--help'] = function(useFull){
	let fullDescription = "--full" == useFull;
	console.log("This is part of the none-batocera.linux replacements for emulatorLauncher.py and configgen.\n"
		+"The aim is to retain as much of the batocera-emulationstation OS integration and configurability as possible\n"
		+"while porting/taking over as little of batocera.linux's quirks/complexity as necessary.\n"
		+"See git repo for Ark-Gamebox for more details.\n"
   	);
	console.log("Possible commands:\n");
	for(key in API){
		if(fullDescription){
			console.log("  * %s %s\n\n  %s\n", key, API[key].description[0], API[key].description.slice(1).join('\n  '));
		} else {
			console.log("  * %s %s - %s\n", key, API[key].description[0], API[key].description[1]);
		}
	}
}
API['-h'].description = ['', 'Print this text. Add --full for detailed descriptions.'];

const args = process.argv.slice(2)
if(args.length == 0) args.push('--help');
	
API[args[0]](...args.slice(1))
