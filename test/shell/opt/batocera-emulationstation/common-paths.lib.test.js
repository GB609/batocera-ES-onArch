Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');
const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/common-paths.lib';

class CommonPathsTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({ HOME: process.env.ES_HOME });
    //use verify to mock away mkdir
    this.verifyFunction('mkdir');
  }

  verifyDefaultConfigRoot() {
    this.verifyVariable("CONFIG_ROOT", "/etc");
    this.execute();
  }

  verifyConfigRootFromOutside() {
    this.environment({ CONFIG_ROOT: TMP_DIR });
    this.verifyVariable("CONFIG_ROOT", TMP_DIR);
    this.execute();
  }

  verifyXdgDirs() {
    this.environment({
      HOME: TMP_DIR,
      XDG_RUNTIME_DIR: '/dev/null'
    });
    this.verifyVariables({
      XDG_RUNTIME_DIR: '/dev/null',
      XDG_CONFIG_HOME: TMP_DIR + '/.config',
      XDG_DATA_HOME: TMP_DIR + '/.local/share',
      XDG_STATE_HOME: TMP_DIR + '/.local/state',
      XDG_CACHE_HOME: TMP_DIR + '/.cache',
    });
    this.execute();
  }
  
  esDirs(){
    
  }
  userDirs(){}
  
  verifyExportedVariables(){
    this.verifyExports(
      "ES_HOME", "ES_CONFIG_HOME",
      "ROMS_ROOT_DIR", "SAVES_ROOT_DIR"
    )
    
    this.execute()
  }
}

runTestClass(CommonPathsTest, FILE_UNDER_TEST)