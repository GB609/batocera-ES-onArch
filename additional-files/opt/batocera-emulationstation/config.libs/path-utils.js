const path = require('node:path');
const SYSTEMS_GREP = `grep -Eho '<path>.*</path>' ${getConfigHome()}/es_systems*.cfg`;
const VALID_ROM_PATH = /^(\w[\w\S ]+?)\/([\w\S ]+\/)?(\w[\w\S ]+?)$/;

function romInfoFromPath(romPath, system) {
  let relativeRomPath;
  if (!path.isAbsolute(romPath)) {
    romPath = path.resolve(romPath);
  }

  let { execSync } = require('node:child_process');
  let systemPaths = execSync(SYSTEMS_GREP, { encoding: 'utf8' }).split('\n').map(_sanitizeSysCfgPath);

  for (let p of systemPaths) {
    if (romPath.startsWith(p)) {
      relativeRomPath = path.relative(p, romPath);
      break;
    }
  }

  let result = VALID_ROM_PATH.exec(relativeRomPath);
  if (result == null) {
    throw new Error(`[${relativeRomPath}] does not match valid path spec [${VALID_ROM_PATH}]`);
  }

  let extension = path.extname(result[3]).substring(1);
  return {
    absPath: romPath,
    system: result[1],
    subfolders: (path.result[2] || '').split('/').filter(_ => _.length > 0),
    game: result[3],
    //without the dot
    extension: extension,
    gameNoExt: path.basename(result[3], '.' + extension)
  }
}

const PATH_TAG = /<.?path>/g;
const TILDE_START = /^~\//;
function _sanitizeSysCfgPath(sysPath) {
  return path.resolve(sysPath.replace(PATH_TAG, '').replace(TILDE_START, getHome()));
}

function resolveRomDir(romDir = ROMS_DIR_TAG) {
  let fallbackDir = path.resolve(process.env['ROMS_ROOT_DIR'] || '~/ROMs');
  return romDir.includes(ROMS_DIR_TAG)
    ? romDir.replace(ROMS_DIR_TAG, fallbackDir)
    : path.resolve(romDir)
}

function absRomPath(file, romDir) {
  let effectiveRomDir = resolveRomDir(romDir);
  let normalized = path.normalize(file);
  if (path.matchesGlob(normalized, effectiveRomDir + '/*')) {
    return path;
  } else if (path.isAbsolute(normalized)) {
    throw new Error(`[${file}] points to absolute path outside of rom-root-dir [${effectiveRomDir}]`);
  }

  return path.resolve(effectiveRomDir, normalized);
}

function getHome() { return process.env['ES_HOME'] || process.env['HOME']; }
function getConfigHome() { return process.env["ES_CONFIG_HOME"] || (getHome() + "/.emulationstation") }

module.exports = {
  resolveRomDir,
  absRomPath,
  romInfoFromPath,
  getHome,
  getConfigHome
}