Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');

enableLogfile();

const FILE_UNDER_TEST = 'opt/emulatorlauncher/lib/.controls.lib';

class ControlsLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({ HOME: process.env.ES_HOME });
    //this.verifyFunction('_hasBin', { code: 1 });
    this.verifyFunction("_isTrue", { code: 1 });
  }

  hideMouse() {
    this.verifyFunction('_hasBin', { code: 0 });
    this.verifyFunction("_isTrue", { code: 0 });

    this.verifyVariable("_PRE_RUN_OPERATIONS", ['_startUnclutter']);
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

  useDesktopProfile() {

  }
}

class SdlConfigTest extends ControlsLibTest {
  inheritFromProcess() {
    this.environment({ SDL_GAMECONTROLLERCONFIG: "this comes from outside" });
    this.preActions.push('sdl_config="inherit"')
    this.verifyVariable('SDL_GAMECONTROLLERCONFIG', "this comes from outside");
    this.execute();
  }
  
  noneUnsetsSdl() {
    this.preActions.push(
      'sdl_config="none"',
      'SDL_GAMECONTROLERCONFIG="ABCDEFGH"'
    );
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