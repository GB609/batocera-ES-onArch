Object.assign(globalThis, require('test-helpers.mjs'));

const { resolve } = require('path');
const { symlinkSync } = require('node:fs');
const { execSync } = require('node:child_process');

enableLogfile();

function loadFile(filePath){
  LOGGER.info("Loading", filePath);
  require(filePath);
}

let searchPath = resolve(`${SRC_PATH}`);
try { symlinkSync(searchPath + '/btc-config', searchPath + '/cfg.js'); }
catch (e) {}

LOGGER.info("Searching source files for coverage in path:", searchPath);
let found = execSync(`find '${searchPath}' -name '*.js'`, { encoding: 'utf8' });

let filelist = found.trim().split('\n').map(path => path.replace(SRC_PATH+'/', ''));
test('Load all files once', parameterized(filelist, loadFile, '${0}'));
