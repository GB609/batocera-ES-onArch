const path = require('path');
const VALID_ROM_PATH = /^(\w[\w\S ]+?)\/([\w\S ]+\/)?(\w[\w\S ]+?)$/;

function romInfoFromPath(relativeRomPath) {
  if (path.isAbsolute(relativeRomPath)) {
    throw new Error('Expected relative path, but got ' + relativeRomPath);
  }

  let result = VALID_ROM_PATH.exec(relativeRomPath);
  if (result == null) {
    throw new Error(`[${relativeRomPath}] does not match valid path spec [${VALID_ROM_PATH}]`);
  }

  let extension = path.extname(result[3]).substring(1);
  return {
    system: result[1],
    subfolders: (path.result[2] || '').split('/').filter(_ => _.length > 0),
    game: result[3],
    //without the dot
    extension: extension,
    gameNoExt: path.basename(result[3], '.' + extension)
  }
}

function resolveRomDir(romDir) {
  return path.resolve(romDir || process.env['ROMS_ROOT_DIR'] || '~/ROMs');
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

module.exports = {
  resolveRomDir,
  absRomPath,
  romInfoFromPath
}