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

  static controllerEventsDisabledWhenProfileActive = parameterized(
    [
      'none',
      'deactivated',
      'u-game',
      'u-system',
      'u-emu',
      'int-desktop',
      'int-fps',
      'int-rpg'
    ],
    function(profileValue) {
      this.preActions.push(`controller_profile="${profileValue}"`);
      if (profileValue == "none") {
        this.verifyVariable('_launchPrefix', ['']);
      } else {
        this.verifyVariable('_launchPrefix',
          ['firejail --noprofile --blacklist=/dev/input/event* --blacklist=/dev/input/js*']
        );
      }
      this.execute();
    },
    'controller_profile=${0}'
  )

  /** 
    * Test if any of the 'int-' properties are resolved correctly.
    * Currently only supports 'int-desktop' because the other profiles have not been defined yet.
    */
  static useInternalProfile = parameterized([ 'desktop', 'rpg', 'fps' ], function(profileName) {
    let profilePath = `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles/${profileName}.gamecontroller.amgp`;
    assert.ok(fs.existsSync(profilePath), `${relative(process.env.SRC_DIR, profilePath)} does not exist!`);
    this.preActions.push(`controller_profile="int-${profileName}"`);
    // when desktop is set, a pre-run hook must be installed (and a post-run hook as well)
    this.verifyVariable('_PRE_RUN_OPERATIONS', [ `_amx:restart --hidden --profile '${profilePath}'` ] );
    this.execute()
  }, 'controller_profile=int-${0}');
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
