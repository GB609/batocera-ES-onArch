Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/amx.lib';

class AmxLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      CONFIG_ROOT: process.env.SRC_DIR + '/etc'
    });
  }

  guideMode() {
    this.verifyFunction(
      '_amx:restart', 
      '--hidden', '--tray', '--profile',
      `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles/GUIDE.gamecontroller.amgp`
    );
    this.postActions(
      this.functionVerifiers['_amx:restart'],
      '_amx:guideMode'
    );
    this.execute()
  }
  
  restartPassesArgsToAmx(){
    this.verifyFunction('kill');
    this.verifyFunction('antimicrox', 
      { forks:true }, 
      '--no-tray', '--profile', '/some/path/to/pro file'
    );
    this.postActions(
      '_amx:restart --no-tray --profile "/some/path/to/pro file"'
    );
    this.execute();
  }

  amxPidTest(){
    assert.fail("feature + test implementation missing");
  }
}

runTestClass(AmxLibTest, FILE_UNDER_TEST)