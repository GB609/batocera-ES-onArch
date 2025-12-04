const { ShellTestRunner } = require('js/utils/shelltest.mjs');
const { readFileSync, existsSync } = require('node:fs');

enableLogfile();

const FILE_UNDER_TEST = 'usr/bin/emulationstation-native';

class NativeRunTests extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      PATH: process.env.PATH,
      HOME: process.env.FS_ROOT + '/home/test',
      ES_CONFIG_HOME: process.env.FS_ROOT + '/home/test/.emulationstation',
      FS_ROOT: process.env.SRC_DIR,
      CONFIG_ROOT: process.env.TEST_FS + '/configs',
      ROMS_ROOT_DIR: process.env.FS_ROOT + '/home/test/ROMs',
      SAVES_ROOT_DIR: this.TMP_DIR,
      controller_profile: 'none'
    });
  }

  runByAutorunCmd() {
    this.arguments('run', '$ROMS_ROOT_DIR/ports/native game.nla');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/native game.nla/save_data/subdirectory/.state`;
    let content = `1:42 2:blank something\nDIR:${this.TMP_DIR}/ports/native game.nla/prefix/subdirectory\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);
  }
}

runTestClasses(FILE_UNDER_TEST, NativeRunTests)