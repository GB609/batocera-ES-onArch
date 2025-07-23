import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative } from 'path';

import * as helpers from './test-helpers.mjs';
Object.assign(globalThis, helpers);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_PATH = resolve(dirname(__dirname));
const CWD_REL = relative(__dirname, ROOT_PATH);
const TMP_DIR = `${ROOT_PATH}/tmp`

globalThis.ROOT_PATH = ROOT_PATH;
globalThis.SRC_PATH = `${ROOT_PATH}/sources/fs-root/opt/batocera-emulationstation`;
globalThis.LIB_PATH = `${ROOT_PATH}/sources/fs-root/opt/batocera-emulationstation/config.libs`;
globalThis.TMP_DIR = TMP_DIR;
globalThis.FS_ROOT = TMP_DIR + "/FS_ROOT"
globalThis.__filename = __filename
globalThis.__dirname = __dirname

process.env.FS_ROOT = globalThis.FS_ROOT

const require = createRequire(import.meta.url);
globalThis.requireSrc = function(path) {
  console.error("REQUIRE SRC:", path)
  if (path.startsWith("./")) {
    path = SRC_PATH + "/" + path;
  }
  try {
    return require(path);
  } catch (error) {
    console.error(path, "not loaded:", error);
    throw error;
  }
}
 Object.assign(globalThis, requireSrc('./config.libs/path-utils'));