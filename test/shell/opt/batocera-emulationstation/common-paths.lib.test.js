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

  esDirs() {
    this.environment({
      XDG_RUNTIME_DIR: '/dev/null',
      XDG_CONFIG_HOME: TMP_DIR + '/.config',
      XDG_DATA_HOME: TMP_DIR + '/.local/share',
      XDG_STATE_HOME: TMP_DIR + '/.local/state',
      XDG_CACHE_HOME: TMP_DIR + '/.cache',
    });

    this.verifyVariables({
      ES_DATA_DIR: TMP_DIR + '/.local/share/emulationstation',
      ES_STATE_DIR: TMP_DIR + '/.local/state/emulationstation',
      ES_CACHE_DIR: TMP_DIR + '/.cache/emulationstation'
    });
    this.execute();
  }

  overwriteEsDirs() {
    const varDecl = {
      ES_DATA_DIR: '/var/tmp/data/es',
      ES_STATE_DIR: '/var/tmp/state/es',
      ES_CACHE_DIR: '/var/tmp/cache/es',
    }
    this.environment(varDecl)
    this.verifyVariables(varDecl);
    this.execute();
  }

  userDirs() {
    this.verifyVariables({
      ROMS_ROOT_DIR: `${process.env.ES_HOME}/ROMs`,
      SAVES_ROOT_DIR: `${process.env.ES_HOME}/.local/share/emulationstation/saves`
    });
    this.execute();
  }

  overwriteUserDirs() {
    const varDecl = {
      ROMS_ROOT_DIR: '/var/tmp/ROMS',
      SAVES_ROOT_DIR: '/var/tmp/userdata'
    };
    this.environment(varDecl)
    this.verifyVariables(varDecl);
    this.execute();
  }

  verifyExportedVariables() {
    this.verifyExports(
      "ES_HOME", "ES_CONFIG_HOME",
      "ROMS_ROOT_DIR", "SAVES_ROOT_DIR"
    )

    this.execute()
  }
}

runTestClass(CommonPathsTest, FILE_UNDER_TEST)