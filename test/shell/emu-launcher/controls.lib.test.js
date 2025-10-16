Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');

enableLogfile();

const FILE_UNDER_TEST = 'opt/emulatorlauncher/.controls.lib';

class ControlsLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({ HOME: process.env.ES_HOME });
    this.verifyFunction('_hasBin', { code: 1 });
    this.verifyFunction("_isTrue", { code: 1 });
  }

  hideMouse() {
    this.verifyFunction('_hasBin', { code: 0 });
    this.verifyFunction("_isTrue", { code: 0 });
    
    this.verifyVariable("_PRE_RUN_OPERATIONS", ['_startUnclutter']);
    this.execute();
  }
}

runTestClass(ControlsLibTest, FILE_UNDER_TEST)