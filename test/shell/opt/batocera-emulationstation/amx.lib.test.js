Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/amx.lib'

const AMX_PID_FILE = TMP_DIR + '/amx.state';

class AmxLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    if (fs.existsSync(AMX_PID_FILE)) { fs.rmSync(AMX_PID_FILE) }

    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      CONFIG_ROOT: process.env.SRC_DIR + '/etc',
      XDG_RUNTIME_DIR: TMP_DIR
    });
  }

  guideMode() {
    this.verifyFunction(
      '_amx:restart',
      '--hidden', '--tray', '--profile',
      `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles/GUIDE.gamecontroller.amgp`
    );
    this.postActions(
      this.functionVerifiers['_amx:restart'],
      '_amx:guideMode'
    );
    this.execute()
  }

  restartPassesArgsToAmx() {
    this.verifyFunction('kill');
    this.verifyFunction('antimicrox',
      { forks: true },
      '--no-tray', '--profile', '/some/path/to/pro file'
    );
    this.postActions(
      '_amx:restart --no-tray --profile "/some/path/to/pro file"'
    );
    this.execute();
  }

  amxPidGetNoAMX() {
    this.verifyFunction('pgrep', { out: 42 }, 'antimicrox')
    this.postActions('amxId=$(_amx:pid)');
    this.verifyVariable('amxId', 42);
    this.execute();
  }

  amxPidSet() {
    let time = new Date();
    let timeOfDay = `${time.getHours()}${time.getMinutes()}${time.getSeconds()}`;

    this.postActions(`_amx:pid ${timeOfDay}`);
    this.execute();

    assert.equal(fs.readFileSync(AMX_PID_FILE, { encoding: 'utf8' }), timeOfDay);
  }
}

runTestClass(AmxLibTest, FILE_UNDER_TEST)