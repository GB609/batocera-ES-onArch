Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');

enableLogfile();

let pu = require("utils/path")

const realEnvs = process.env;
const cwd = process.cwd();

const TEST_PATH = "relative/none-existing/../strange";
const TEST_PATH_CANONICAL = "relative/strange";

class PathUtilsTest {

  beforeEach() { 
    process.env = { 
      "HOME": "/test-home",
      "ROMS_ROOT_DIR": "/test-roms" 
    }
  }
  afterEach() { process.env = realEnvs }


  static testSetGetDirs = parameterized(
    [
      ["Home", "ES_HOME", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["Home", "ES_HOME", './testdir/sub/..', cwd + '/testdir'],

      ["ConfigHome", "ES_CONFIG_HOME", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["ConfigHome", "ES_CONFIG_HOME", './testdir/sub/..', cwd + '/testdir'],

      ["RomDir", "ROMS_ROOT_DIR", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["RomDir", "ROMS_ROOT_DIR", './testdir/sub/..', cwd + '/testdir']
    ],
    function testSetGetPaths(pathProp, varname, pathToSet, expected) {
      let setter = pu[`set${pathProp}`];
      let getter = pu[`get${pathProp}`];

      assert.notEqual(process.env[varname], pathToSet);
      setter(pathToSet);
      assert.equal(process.env[varname], pathToSet);

      assert.equal(getter(), expected);
    }
  )

  static testEnvVarOrAbsPath = parameterized(
    [
      ['./', cwd + "/" + TEST_PATH_CANONICAL],
      ['/', "/" + TEST_PATH_CANONICAL],
    ],
    function testEnvPath(pathPrefix, expectedAbs) {
      let testPath = pathPrefix + TEST_PATH;
      assert.equal(pu.envOrVarAbsPath('SOME_VAR', testPath + "/fallback"), expectedAbs + "/fallback");

      process.env['SOME_VAR'] = pathPrefix + TEST_PATH;
      assert.equal(pu.envOrVarAbsPath('SOME_VAR'), expectedAbs);
    }
  )

  static testResolveRomPath = parameterized(
    [
      ['~/ABCD', '/test-home/ABCD'],
      ['%ROMSDIR%/testSystem', '/test-roms/testSystem'],
      ['~/ABCD/./X/..', '/test-home/ABCD'],
      ['%ROMSDIR%/testSystem/sub/..', '/test-roms/testSystem']
    ],
    function testPathResolve(pathToResolve, expected){ assert.equal(expected, pu.resolveRomPath(pathToResolve)) }
  )
  
  static testIsValidPath = parameterized(
    [
      [null, false],
      ["", false],
      ['/not-existing', false],
      [cwd, true],
      ['/', true]
    ],
    function checkValidityResult(path, isValid){ assert.equal(pu.isValidPath(path), isValid) }
  )
}

runTestClass(PathUtilsTest)
