import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative } from 'path';
import * as helpers from './test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_PATH = resolve(dirname(__dirname));
const CWD_REL = relative(__dirname, ROOT_PATH);
const TMP_DIR = `${CWD_REL}/tmp`

globalThis.SRC_PATH = `${CWD_REL}/additional-files/opt/batocera-emulationstation`;
globalThis.LIB_PATH = `${CWD_REL}/additional-files/opt/batocera-emulationstation/config.libs`;
globalThis.FS_ROOT = TMP_DIR + "/FS_ROOT"

Object.assign(globalThis, helpers);

console.log("import url:", import.meta.url, 'pwd', process.cwd())
let require = createRequire(import.meta.url);

globalThis.require = function(path) {
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

const exec = require('node:child_process').execSync;

// require each file once to get it added to coverage
let searchPath = resolve(`${__dirname}/${SRC_PATH}`);
console.log("Searching source files for coverage in path:", searchPath);
let found = exec(`find '${searchPath}' -name '*.js'`, { encoding: 'utf8' });
found.trim().split('\n').forEach(file => {
  console.log("Loading", file);
  require(file);
});
