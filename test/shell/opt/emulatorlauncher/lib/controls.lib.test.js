Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { relative } = require('node:path');
const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/emulatorlauncher/lib/.controls.lib';
const GUIDE_PROFILE = '/path/to/GUIDE';

TMP_DIR += '/controls.lib.test'

class ControlsLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    if (fs.existsSync(TMP_DIR)) { fs.rmSync(TMP_DIR, { recursive: true, force: true }) }

    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      CONFIG_ROOT: `${process.env.SRC_DIR}/etc`,
      XDG_RUNTIME_DIR: TMP_DIR,
      _GUIDE_PROFILE: GUIDE_PROFILE,
      _CONTROLLER_PROFILE_DIR: `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles`
    });
    this.verifyFunction("_isTrue", { code: 1 });
  }

  hideMouse() {
    this.verifyFunction('_hasBin', { code: 0 });
    this.verifyFunction("_isTrue", { code: 0 });

    this.verifyVariable("_PRE_RUN_OPERATIONS", ['_controls:startUnclutter']);
    this.execute();
  }

  callToUnclutter() {
    this.verifyFunction('unclutter', '--timeout', 1, '--jitter', 3, '--ignore-scrolling', '--hide-on-key-press');
    this.postActions('_controls:startUnclutter');
    this.verifyVariable("_POST_RUN_ACTIONS", ['kill [[:digit:]]+']);
    this.execute();
  }
}

class SdlConfigTest extends ControlsLibTest {

  beforeEach() {
    super.beforeEach();
    this.environment({ SDL_GAMECONTROLLERCONFIG: "this comes from outside" });
  }

  inheritFromProcess() {
    this.preActions.push('sdl_config="inherit"')
    this.verifyVariable('SDL_GAMECONTROLLERCONFIG', "this comes from outside");
    this.execute();
  }

  noneUnsetsSdl() {
    this.preActions.push('sdl_config="none"');
    this.verifyVariable('SDL_GAMECONTROLLERCONFIG', '');
    this.execute();
  }

  passthroughFromBatocera() {
    this.preActions.push(
      'sdl_config="passthrough"',
      'declare -A batocera_sdl',
      'batocera_sdl["0"]="ABCDEF"'
    );
    //array iteration order is not deterministic
    this.verifyVariable('SDL_GAMECONTROLLERCONFIG', 'ABCDEF');
    this.execute();
  }
}

runTestClasses(FILE_UNDER_TEST, ControlsLibTest, SdlConfigTest)
