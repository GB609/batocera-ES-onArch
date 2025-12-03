const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-paths.lib';

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
    this.environment({ CONFIG_ROOT: this.TMP_DIR });
    this.verifyVariable("CONFIG_ROOT", this.TMP_DIR);
    this.execute();
  }

  verifyXdgDirs() {
    this.environment({
      HOME: this.TMP_DIR,
      XDG_RUNTIME_DIR: '/dev/null'
    });
    this.verifyVariables({
      XDG_RUNTIME_DIR: '/dev/null',
      XDG_CONFIG_HOME: this.TMP_DIR + '/.config',
      XDG_DATA_HOME: this.TMP_DIR + '/.local/share',
      XDG_STATE_HOME: this.TMP_DIR + '/.local/state',
      XDG_CACHE_HOME: this.TMP_DIR + '/.cache',
    });
    this.execute();
  }

  esDirs() {
    this.environment({
      XDG_RUNTIME_DIR: '/dev/null',
      XDG_CONFIG_HOME: this.TMP_DIR + '/.config',
      XDG_DATA_HOME: this.TMP_DIR + '/.local/share',
      XDG_STATE_HOME: this.TMP_DIR + '/.local/state',
      XDG_CACHE_HOME: this.TMP_DIR + '/.cache',
    });

    this.verifyVariables({
      ES_DATA_DIR: this.TMP_DIR + '/.local/share/emulationstation',
      ES_STATE_DIR: this.TMP_DIR + '/.local/state/emulationstation',
      ES_CACHE_DIR: this.TMP_DIR + '/.cache/emulationstation'
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

  checkOutdatedNoTarget() {
    this.postActions(
      `_checkOutdated '/some/file' "${FILE_UNDER_TEST}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 0);
    this.execute();
  }

  checkOutdatedSourceIsNewer() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.postActions(
      `echo 'data' >"${targetFile}"`,
      'sleep 1s',
      `echo 'data' >"${sourceFile}"`,
      `_checkOutdated "${targetFile}" "${sourceFile}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 0);
    this.execute();
  }
  checkOutdatedTargetIsNewest() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.postActions(
      `echo 'data' >"${sourceFile}"`,
      'sleep 1s',
      `echo 'data' >"${targetFile}"`,
      //script tests abort when encountering exitCode!=0, but the next command is expected to be 1
      //so we must disable the auto-fail again
      'set +e',
      `_checkOutdated "${targetFile}" "${sourceFile}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 1);
    this.execute();
  }
}

runTestClass(CommonPathsTest, FILE_UNDER_TEST)