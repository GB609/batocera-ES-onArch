
const { isAbsolute, resolve, extname, basename, relative } = require('node:path');
const { existsSync } = require('node:fs');
const SYSTEMS_GREP = `grep -Eho '<system>|<path>.*</path>|<name>.*</name>' ${getConfigHome()}/es_systems*.cfg`;
const VALID_ROM_PATH = /^(\w[\w\S ]+\/)?([\w\S ]+?)\/?$/;
const ROMS_DIR_TAG = '%ROMSDIR%';

function romInfoFromPath(romPath, system = null) {
  let relativeRomPath = null;
  if (!isAbsolute(romPath) || !existsSync(romPath)) {
    romPath = resolve(romPath);
  }
  romPath = _sanitizeSysCfgPath(romPath);

  let sysPathMappings = {};
  let systemPath;
  let { execSync } = require('node:child_process');
  let systems = execSync(SYSTEMS_GREP, { encoding: 'utf8' }).split('<system>');
  systems.forEach(_ => Object.assign(sysPathMappings, _xmlToSysMapping(_)));

  if (system == null) {
    for (let [sys, path] of Object.entries(sysPathMappings)) {
      if (romPath.startsWith(path)) {
        system = sys;
        break;
      }
    }
  }

  systemPath = sysPathMappings[system] || null;
  if (systemPath != null) { relativeRomPath = relative(systemPath, romPath) }

  //there is no configured system path for the given rom, but a system was given as argument
  //treat the rom as being at the root path for the sake of property path analysis
  if (relativeRomPath == null && system != null) {
    systemPath = sysPathMappings[system];
    if (typeof systemPath == "undefined") {
      throw new Error(`[${romPath}] outside of known systems paths and given system [${system}] is not valid.`);
    }
    let fakedRootRom = romInfoFromPath(resolve(systemPath, basename(romPath)));
    fakedRootRom.absPath = romPath;
    return fakedRootRom;
  }

  let result = VALID_ROM_PATH.exec(relativeRomPath);
  if (result == null) {
    throw new Error(`[${relativeRomPath}] does not match valid path spec [${VALID_ROM_PATH}]`);
  }

  let extension = extname(result[2]).substring(1);
  return {
    absPath: romPath,
    system: system,
    systemPath: systemPath,
    subfolders: (result[1] || '').split('/').filter(_ => _.length > 0),
    game: result[2],
    //without the dot
    extension: extension,
    gameNoExt: basename(result[2], '.' + extension)
  }
}

const NAME_TAG = /<.?name>/g;
const PATH_TAG = /<.?path>/g;
const TILDE_START = /^~\//;
/** 
 * expects to output of the grep above.
 * <name>, and <path> will always come in pairs
 */
function _xmlToSysMapping(sysString) {
  let [val1, val2] = sysString.trim().split('\n');
  if ([val1, val2].includes(undefined)) { return {} }
  if (NAME_TAG.test(val1)) {
    return { [val1.replace(NAME_TAG, '')]: val2.replace(PATH_TAG, '') }
  }
  return { [val2.replace(NAME_TAG, '')]: val1.replace(PATH_TAG, '') }
}
function _sanitizeSysCfgPath(sysPath) {
  return resolve(sysPath.replace(TILDE_START, getHome()).replace(ROMS_DIR_TAG, getRomDir()));
}

function getHome() { return process.env['ES_HOME'] || process.env['HOME']; }
function getConfigHome() { return process.env["ES_CONFIG_HOME"] || (getHome() + "/.emulationstation") }
function getRomDir() { return resolve(process.env['ROMS_ROOT_DIR'] || '~/ROMs') }

module.exports = {
  romInfoFromPath,
  getHome,
  getConfigHome,
  getRomDir,
  ROMS_DIR_TAG
}