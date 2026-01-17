const { ShellTestRunner } = require('js/utils/shelltest.mjs');
const { readFileSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');

enableLogfile();

const FILE_UNDER_TEST = 'usr/bin/emulationstation-native';

class NativeRunTests extends ShellTestRunner {
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

  afterEach() {
    try {
      let leftOverMounts = execSync(`mount | grep '${this.TMP_DIR}' || echo -n ''`, { encoding: 'utf8' });
      assert.equal(leftOverMounts.length, 0, leftOverMounts);
    } finally {
      super.afterEach();
    }
  }

  runByAutorunCmd() {
    this.arguments('run', '$ROMS_ROOT_DIR/ports/native game.nla');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/native game.nla/save_data/subdirectory/.state`;
    let content = `1:42 2:blank something\nDIR:${this.TMP_DIR}/ports/native game.nla/prefix/subdirectory\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);
  }

  runByDesktopFile() {
    this.environment({
      TEST_VAR1: 609,
      TEST_VAR2: "Absolute"
    })
    this.arguments('run', '$ROMS_ROOT_DIR/ports/desktop game.desktop');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/desktop game.desktop/save_data/.state`;
    let content = `1:609 2:Absolute\nDIR:${this.TMP_DIR}/ports/desktop game.desktop/prefix\n`;
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
      TEST_VAR1: 609,
      TEST_VAR2: "Absolute"
    })
    this.arguments('run', '$ROMS_ROOT_DIR/ports/echo-testvars.sh');
    this.execute();

    let stateFile = `${this.TMP_DIR}/ports/echo-testvars.sh/save_data/.state`;
    let content = `1:609 2:Absolute\nDIR:${this.TMP_DIR}/ports/echo-testvars.sh/prefix\n`;
    assert.ok(existsSync(stateFile));
    assert.equal(readFileSync(stateFile, { encoding: 'utf8' }), content);
  }
}

runTestClasses(FILE_UNDER_TEST, NativeRunTests)