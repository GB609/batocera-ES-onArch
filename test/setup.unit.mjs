import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative } from 'path';

/*
This file expects to be used/included from run-js-tests.sh with
NODE_PATH set to contain test and application source directories
*/

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
process.env.ES_HOME = `${ROOT_PATH}/test/resource/fs_root/home/test`

const require = createRequire(import.meta.url);
Object.assign(globalThis, require('config.libs/path-utils'));