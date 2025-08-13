Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');

enableLogfile();

let pu = require("config.libs/path-utils")

const realEnvs = process.env;
const cwd = process.cwd();

class PathUtilsTest {

  beforeEach() { process.env = { "HOME": "/test-home"} }
  afterEach() { process.env = realEnvs }

  static testSetGetDirs = parameterized(
    [
      ["Home", "ES_HOME", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["Home", "ES_HOME", './testdir/sub/..', cwd+'/testdir'],
      
      ["ConfigHome", "ES_CONFIG_HOME", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["ConfigHome", "ES_CONFIG_HOME", './testdir/sub/..', cwd+'/testdir'],
      
      ["RomDir", "ROMS_ROOT_DIR", '/test-home/somepath/"with sub"', '/test-home/somepath/"with sub"'],
      ["RomDir", "ROMS_ROOT_DIR", './testdir/sub/..', cwd+'/testdir']
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
}

runTestClass(PathUtilsTest)
