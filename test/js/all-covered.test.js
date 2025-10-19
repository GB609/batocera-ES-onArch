Object.assign(globalThis, require('test-helpers.mjs'));

const { resolve, relative, dirname, basename } = require('path');
const { symlinkSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const assert = require('node:assert/strict');

const SRC_ROOT = `${ROOT_PATH}/sources/fs-root`;
const SH_TEST_ROOT = `${ROOT_PATH}/test/shell`;
const NL = '\n';
const UTF8 = { encoding: 'utf8' };

enableLogfile();

function loadFile(filePath) {
  LOGGER.info("Loading", filePath);
  require(filePath);
}

let searchPath = resolve(`${SRC_PATH}`);
try { symlinkSync(searchPath + '/btc-config', searchPath + '/cfg.js'); }
catch (e) { }

LOGGER.info("Searching source files for coverage in path:", searchPath);
let found = execSync(`find '${searchPath}' -name '*.js'`, { encoding: 'utf8' });

let filelist = found.trim().split('\n').map(path => path.replace(SRC_PATH + '/', ''));
test('Load all files once', parameterized(filelist, loadFile, '${0}'));

/** Search all shell files */
let findString = ["sh", "lib"].map(ext => `-name '*.${ext}'`).join(' -or ');
let foundFiles = [...execSync(`find '${SRC_ROOT}' ${findString}`, UTF8).trim().split(NL)];

let executableCandidates = execSync(`find '${SRC_ROOT}' -type f -executable`, UTF8).trim().split(NL);
foundFiles.push(
  ...executableCandidates.filter(c => execSync(`file '${c}'`, UTF8).includes('shell script'))
)

function existsTest(scriptFile) {
  let relPath = relative(SRC_ROOT, scriptFile);
  relPath = `${dirname(relPath)}/${basename(relPath).replace(/^\./, '')}`;
  
  let shellTestFile = `${SH_TEST_ROOT}/${relPath}.test.js`;
  if (!existsSync(shellTestFile)) {
    assert.fail(`No test at [${relative(ROOT_PATH, shellTestFile)}]`);
  }
}

test('All shell files are tested',
  parameterized(
    foundFiles,
    existsTest,
    (dict, fn, file) => relative(SRC_ROOT, file)
  )
);
