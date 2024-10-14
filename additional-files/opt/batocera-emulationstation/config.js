#!/usr/bin/node

//const yml = require('yaml');
//const xml = require('xml');
const fs = require('fs');
const { execSync } = require('child_process');
const cfg = {};

const	FOLDER_SPEC=/^\w+(\.folder\["(.*)"\]).*=.*/;
const GAME_SPEC=/^\w+\["(.*?)"\].*/;

cfg.btcPropDetails = function(propLine){
	if(!propLine.includes("=")) return false;
	console.error('initial:', propLine);
	
	let system, folder, game, fspath, key, value, commented;
	commented = `${propLine}` != (propLine = propLine.replace('#', ''));
	
	if(fspath = FOLDER_SPEC.exec(propLine)) {
		propLine = propLine.replace(fspath[1], '');
		fspath = fspath[2].replace(/^\/userdata\/roms\//, '');
		console.error('after folder removal:', propLine);
	} else if(fspath = GAME_SPEC.exec(propLine)){
		fspath = fspath[1];
		propLine = propLine.replace(`["${fspath}"]`, '');
		console.error('after game removal:', propLine);
	}
	
	propLine = propLine.replace(/\./g, '/').split('=', 2);
	key = propLine[0].split('/');
	if(fspath){
		fspath = fspath.split('/');
		let idx = fspath.indexOf(key[0]);
		if(idx >= 0){ fspath = fspath.slice(idx+1); }
		key = [key.shift(), ...fspath, ...key];
	}
	fspath = key.slice(0, key.length-1);
	key = key.pop();
	value = propLine[1];
	
	console.log(`'${fspath.join("/")}.cfg'`, (commented ? '#' : '') + key, `'${value}'`);
	
	return;
	
	/*
	return {
		file:fileName,
		key:keyName,
		value:value,
		commented:!isActive
	};*/
}

const args=process.argv.slice(2)
cfg[args[0]](...args.slice(1))
