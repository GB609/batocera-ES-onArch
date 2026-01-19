// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');
const { readFileSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');

enableLogfile();

const FILE_UNDER_TEST = 'usr/bin/emulationstation-native';

/**
 * This class contains basic blackbox tests of the core behaviour and features of `emulationstation-native`.  
 * @requires fuse-overlayfs
 */
class NativeRunTests extends ShellTestRunner {
  /**
   * Sets up the variables declared in `/etc/batocera-paths.conf` and `/opt/batocera-emulationstation/lib/user-paths.lib`
   * so that the tests can run from source directories.  
   * Writes will go to a temporary directory which is provided empty and anew for each test run. 
   */
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      PATH: process.env.PATH,
      HOME: process.env.ES_HOME,
      XDG_HOME: this.TMP_DIR + '/xdg',
      ES_CONFIG_HOME: process.env.ES_HOME + '/.emulationstation',
      FS_ROOT: process.env.SRC_DIR,
      CONFIG_ROOT: process.env.FS_ROOT + '/etc/batocera-emulationstation',
      ROMS_ROOT_DIR: process.env.ES_HOME + '/ROMs',
      SAVES_ROOT_DIR: this.TMP_DIR,
      controller_profile: 'none'
    });
  }

  /**
   * Performs one additional validation before calling `super.afterEach()`:  
   * Make sure that the overlay-fs mount has been disassembled. This MUST always happen in any case, even when
   * there are errors in 'negative' tests. Otherwise repeated trials/launches will entirely mess up a user's
   * current session.
   */
  afterEach(ctx) {
    try {
      let leftOverMounts = execSync(`mount | grep '${this.TMP_DIR}' || echo -n ''`, { encoding: 'utf8' });
      if (leftOverMounts.length > 0) {
        ctx.diagnostic("There are overlay-fs mounts remaining!\n" + leftOverMounts);
        assert.fail(leftOverMounts);
      }
    } finally {
      super.afterEach(ctx);
    }
  }

  /**
   * Makes sure that `.nla` directories are supported, when containing `autorun.cmd`.  
   * Also verifies that [_delayerUserSave](%%DOC_ROOT%%/dev/files/opt/batocera-emulationstation/lib/launcher-base.lib.md#_delayerusersave) 
   * has correctly extracted the saves from the rest of the files of the library.
   */
  runByAutorunCmd() {
    this.arguments('run', '$ROMS_ROOT_DIR/ports/native game.nla');
    this.execute();

    // generally see if the 'game' starts with all envs set
    let stateFile = `${this.TMP_DIR}/ports/native game.nla/save_data/subdirectory/.state`;
    let content = `1:42 2:blank something\nDIR:${this.TMP_DIR}/ports/native game.nla/prefix/subdirectory\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);

    // verify that the delayering of user saves has worked
    let fs = require('node:fs');
    let dirEntries = fs.readdirSync(`${this.TMP_DIR}/ports/native game.nla/save_data`, { encoding: 'utf8' });
    assert.deepEqual(dirEntries, ['subdirectory']);
    assert.ok(!existsSync(`${this.TMP_DIR}/ports/native game.nla/save_data/.initialised`));

    dirEntries = fs.readdirSync(`${this.TMP_DIR}/ports/native game.nla`, { encoding: 'utf8' });
    assert.deepEqual(dirEntries, ['home', 'prefix', 'save_data']);
  }

  runByDesktopFile() {
    this.environment({
      TEST_VAR1: 'TYPE:desktop',
      TEST_VAR2: "more args"
    })
    this.arguments('run', '$ROMS_ROOT_DIR/ports/desktop game.desktop');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/desktop game.desktop/save_data/.state`;
    let content = `1:TYPE:desktop 2:more args\nDIR:${this.TMP_DIR}/ports/desktop game.desktop/prefix\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);
  }

  runByDesktopFile_invalidPath() {
    this.arguments('run', '$ROMS_ROOT_DIR/ports/invalid-path.desktop');
    this.throwOnError = false;
    this.execute();

    let errLines = this.result.stderr.trim().split('\n');
    assert.equal(errLines.pop(), "Path must be an absolute directory of at least second level e.g. '/home/user'");
  }

  runShScript() {
    this.environment({
      TEST_VAR1: 'TYPE:sh',
      TEST_VAR2: "novars"
    })
    this.arguments('run', '$ROMS_ROOT_DIR/ports/echo-testvars.sh');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/echo-testvars.sh/save_data/.state`;
    let content = `1:TYPE:sh 2:novars\nDIR:${this.TMP_DIR}/ports/echo-testvars.sh/prefix\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);
  }

  failWhenGamePrefixNotEmpty() {
    let prefixDir = `${this.TMP_DIR}/ports/echo-testvars.sh/prefix`;
    this.environment({ GAME_PREFIX: prefixDir });
    this.preActions.push(
      `mkdir -p $GAME_PREFIX`,
      'touch "$GAME_PREFIX"/dummyFile'
    );
    this.arguments('run', '$ROMS_ROOT_DIR/ports/echo-testvars.sh');
    this.throwOnError = false;
    this.execute();

    let errLines = this.result.stderr.trim().split('\n');
    assert.equal(errLines.pop(), 'ERROR: Mount point for _userPrefix is not empty.');
  }
}

runTestClasses(FILE_UNDER_TEST, NativeRunTests)