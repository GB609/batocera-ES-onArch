#!/usr/bin/node

const fs = require('fs');
const { execSync } = require('child_process');
const cfg = {};

const FOLDER_SPEC = /^\w+(\.folder\["(.*)"\]).*=.*/;
const GAME_SPEC = /^\w+\["(.*?)"\].*/;
const YAML_LINE = /^(\s*)([\w-\+]+)\:\s*(.*)/;
//const COMMENT_PREFIX = /^\s*(#+).*/;

cfg.btcPropDetails = function(propLine) {
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

async function readTextPropertyFile(confFile, lineParserCallback) {
	console.error('BEGIN READ: %s:', confFile);

	let util = require("util");
	let properties = [];
	let comments = [];
	let lineReader = require('readline').createInterface({
		input: require('fs').createReadStream(confFile),
		crlfDelay: Infinity,
		terminal: false
	});

	let handler = lineParserCallback.bind(this, properties, comments);
	for await (let line of lineReader) {
		handler(line);
	}

	console.error("END READ: %s", confFile);

	return properties;
}

function parseConfLine(properties = [], comments = [], line) {
	line = cfg.btcPropDetails(line);
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
	if (whitespace <= state.depth) {
		let popNum = Math.ceil((state.depth - whitespace) / state.stepWidth) + 1;
		if(popNum > 0){ state.prefix.splice(-popNum); }
		state.depth = whitespace;
	}

	if (line.endsWith(':') && whitespace >= state.depth) {
		if(ymlLine[2] == 'options'){
			state.prefix.push(null);			
		} else {
			state.prefix.push(ymlLine[2]);
		}
		if (whitespace != state.depth) {
			state.stepWidth = whitespace - state.depth;
		}
		state.depth = whitespace;
	} else if (ymlLine[3] != null && ymlLine[3].length > 0) {
		let prop = state.prefix.filter(k => k!=null).join('.') + `.${ymlLine[2]}=${ymlLine[3]}`;
		properties.push(cfg.btcPropDetails(prop));
	}

}

cfg.importBatoceraConfig = async function(...files) {
	let properties = [];
	for (confFile of files) {
		if (confFile.endsWith('.yaml') || confFile.endsWith('.yml')) {
			let state = { prefix: [], depth: 0 }
			properties.push(...(await readTextPropertyFile(confFile, parseYamlLine.bind(this, state))));
		} else {
			properties.push(...(await readTextPropertyFile(confFile, parseConfLine)));
		}
	}



	//console.log(properties);
}

const args = process.argv.slice(2)
cfg[args[0]](...args.slice(1))
