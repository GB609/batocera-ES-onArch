// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-paths.lib';

class UserPathsTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({ HOME: process.env.ES_HOME });
    //use verify to mock away mkdir
    this.verifyFunction('mkdir');
  }

  verifyXdgDirsHOME() {
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

  verifyXdgDirsXDG_HOME() {
    this.environment({
      XDG_HOME: this.TMP_DIR + '/xdg',
      XDG_RUNTIME_DIR: '/dev/null'
    });
    this.verifyVariables({
      XDG_RUNTIME_DIR: '/dev/null',
      XDG_CONFIG_HOME: this.TMP_DIR + '/xdg/.config',
      XDG_DATA_HOME: this.TMP_DIR + '/xdg/.local/share',
      XDG_STATE_HOME: this.TMP_DIR + '/xdg/.local/state',
      XDG_CACHE_HOME: this.TMP_DIR + '/xdg/.cache',
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
    this.verifyExitCode(`_checkOutdated '/some/file' "${FILE_UNDER_TEST}"`, true);
    this.execute();
  }

  checkOutdatedSourceIsNewer() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.postActions(
      `echo 'data' >"${targetFile}"`,
      'sleep 1s',
      `echo 'data' >"${sourceFile}"`,
    )
    this.verifyExitCode(`_checkOutdated "${targetFile}" "${sourceFile}"`, true);
    this.execute();
  }
  checkOutdatedTargetIsNewest() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.postActions(
      `echo 'data' >"${sourceFile}"`,
      'sleep 1s',
      `echo 'data' >"${targetFile}"`,
    )
    //this.verifyVariable('outdatedResult', 1);
    this.verifyExitCode(`_checkOutdated "${targetFile}" "${sourceFile}"`, false);
    this.execute();
  }
}

runTestClass(UserPathsTest, FILE_UNDER_TEST)