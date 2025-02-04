
const { isAbsolute, resolve, extname, basename, relative } = require('node:path');
const { existsSync } = require('node:fs');
const USER_SYSTEM_CONFIGS = `"${getConfigHome()}"/es_systems*.cfg`
const SYSTEMS_GREP = "grep -Eho '<system>|<path>.*</path>|<name>.*</name>'";
const VALID_ROM_PATH = /^(\w[\w\S ]+\/)?([\w\S ]+?)\/?$/;
const ROMS_DIR_TAG = '%ROMSDIR%';

function romInfoFromPath(romPath, system = null) {
  let relativeRomPath = null;
  if (!isAbsolute(romPath) || !existsSync(romPath)) {
    romPath = resolve(romPath);
  }
  romPath = _sanitizeSysCfgPath(romPath);

  let sysPathMappings = readSystemRomPaths(USER_SYSTEM_CONFIGS);

  let systemPath;
  if (system == null) {
    [system, systemPath] = Object.entries(sysPathMappings).find(entry => romPath.startsWith(entry[1])) || [null, null];
  } else {
    systemPath = sysPathMappings[system] || null;  
  }

  if (systemPath != null && romPath.startsWith(systemPath)) { relativeRomPath = relative(systemPath, romPath) }

  //there is no configured system path for the given rom, but a system was given as argument
  //treat the rom as being at the root path for the sake of property path analysis
  if (relativeRomPath == null && system != null) {
    if (systemPath == null) {
      throw new Error(`[${romPath}] outside of known system paths and given system [${system}] is not valid.`);
    }
    let fakedRomPath = resolve(systemPath, basename(romPath));
    return Object.assign(romInfoFromPath(fakedRomPath), {absPath : romPath});
  }

  let result = VALID_ROM_PATH.exec(relativeRomPath);
  if (result == null) { throw new Error(`[${relativeRomPath}] does not match valid path spec [${VALID_ROM_PATH}]`) }

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
 * <name>, and <path> must come in pairs
 */
function _xmlToSysMapping(sysString) {
  let [val1, val2] = sysString.trim().split('\n');
  if ([val1, val2].includes(undefined)) { return {} }
  let name, path;
  if (NAME_TAG.test(val1) && PATH_TAG.test(val2)) { name = val1; path = val2; } 
  else if (NAME_TAG.test(val2) && PATH_TAG.test(val1)) { name= val2; path = val1; }
  else { return {} } //invalid system, got <name> or <path> 2 times in a row
  return { [name.replace(NAME_TAG, '').trim()]: path.replace(PATH_TAG, '').trim() }
}

function _sanitizeSysCfgPath(sysPath) {
  return resolve(sysPath.replace(TILDE_START, getHome()).replace(ROMS_DIR_TAG, getRomDir()));
}

function getHome() { return resolve(process.env['ES_HOME'] || process.env['HOME']) }
function setHome(newDir = getHome()) { process.env["ES_HOME"] = newDir }

function getConfigHome() { return resolve(process.env["ES_CONFIG_HOME"] || (getHome() + "/.emulationstation")) }
function setConfigHome(newDir = getConfigHome()) { process.env["ES_CONFIG_HOME"] = newDir }

function getRomDir() { return resolve(process.env['ROMS_ROOT_DIR'] || '~/ROMs') }
function setRomDir(newDir = getRomDir()) { process.env['ROMS_ROOT_DIR'] = newDir }

function readSystemRomPaths(...fileGlobs){
  if(fileGlobs.length == 0) { fileGlobs.push(USER_SYSTEM_CONFIGS) }
  let { execSync } = require('node:child_process');
  let { XML } = require('./parsing.js').XML;
  let fullSource = XML.removeComments(execSync(`/bin/cat ${fileGlobs.join(' ')}`, {encoding: 'utf8'})).join('\n');
  let systems = execSync(`${SYSTEMS_GREP}}`, { encoding: 'utf8', input: fullSource }).split('<system>');
  
  let sysPathMappings = {};
  systems.forEach(_ => Object.assign(sysPathMappings, _xmlToSysMapping(_)));
  return sysPathMappings;
}

module.exports = {
  romInfoFromPath, readSystemRomPaths, 
  resolveRomPath: _sanitizeSysCfgPath,
  getHome, setHome,
  getConfigHome, setConfigHome, 
  getRomDir, setRomDir,
  ROMS_DIR_TAG, USER_SYSTEM_CONFIGS
}
