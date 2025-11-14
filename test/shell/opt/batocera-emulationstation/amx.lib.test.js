Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/amx.lib'

TMP_DIR += '/amx.lib.test'

const CACHE_DIR = TMP_DIR + '/.cache/emulationstation';
const AMX_PID_FILE = TMP_DIR + '/amx.state';
const GUIDE_PROFILE = `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles/GUIDE.gamecontroller.amgp`;

class AmxLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    if (fs.existsSync(TMP_DIR)) { fs.rmSync(TMP_DIR, { recursive: true, force: true }) }

    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      CONFIG_ROOT: process.env.SRC_DIR + '/etc',
      XDG_RUNTIME_DIR: TMP_DIR,
      ES_CACHE_DIR: CACHE_DIR
    });
  }

  static afterAll() {
    if (fs.existsSync(TMP_DIR)) { fs.rmSync(TMP_DIR, { recursive: true, force: true }) }
  }

  guideMode() {
    this.verifyFunction(
      '_amx:restart',
      '--hidden', '--tray', '--profile',
      GUIDE_PROFILE
    );
    this.postActions(
      this.functionVerifiers['_amx:restart'],
      '_amx:guideMode'
    );
    this.verifyVariable('_GUIDE_PROFILE', GUIDE_PROFILE);

    this.execute()
  }

  /**
   * _amx:applyGuide does 2 things: 
   * 1. merge a given profile with GUIDE, if it is not GUIDE itself
   * 2. Generate SVG images for the result.
   * This test uses GUIDE to make sure of 2.
   */
  applyGuideRendersImages() {
    const expectedImageDir = `${CACHE_DIR}/controller-profiles/images/GUIDE`;

    this.environment({ PATH: globalThis.SRC_PATH + ':' + process.env.PATH })
    this.postActions(`source <(_amx:applyGuide "${GUIDE_PROFILE}" 3)`);
    this.verifyVariable('_returnValue', { imgDir: expectedImageDir });

    this.execute();

    let createdImages = fs.readdirSync(expectedImageDir, { encoding: 'utf8' });
    assert.deepEqual(createdImages, ['amx_mapping_3 - 1.svg', 'amx_mapping_3 - 8.svg'])
  }

  restartPassesArgsToAmx() {
    this.verifyFunction('kill');
    this.verifyFunction('antimicrox',
      { forks: true },
      '--log-level', 'warn', '--no-tray', '--profile', '"$_GUIDE_PROFILE"'
    );
    this.postActions(
      '_amx:restart --no-tray --profile "$_GUIDE_PROFILE"'
    );
    this.execute();
  }

  amxPidGetNoAMX() {
    this.verifyFunction('pgrep', { out: 42 }, 'antimicrox')
    this.postActions('amxId=$(_amx:pid)');
    this.verifyVariable('amxId', 42);
    this.execute();
  }

  /* FIXME: amx pid isn't save anymore right now
  amxPidSet() {
    let time = new Date();
    let timeOfDay = `${time.getHours()}${time.getMinutes()}${time.getSeconds()}`;

    this.postActions(`_amx:pid ${timeOfDay}`);
    this.execute();

    assert.equal(fs.readFileSync(AMX_PID_FILE, { encoding: 'utf8' }), timeOfDay);
  }*/

  checkOutdatedNoTarget() {
    this.postActions(
      `_amx:checkOutdated '/some/file' "${FILE_UNDER_TEST}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 0);
    this.execute();
  }

  checkOutdatedSourceIsNewer() {
    let sourceFile = TMP_DIR + '/source'
    let targetFile = TMP_DIR + '/target'

    this.postActions(
      `echo 'data' > ${targetFile}`,
      'sleep 1s',
      `echo 'data' > ${sourceFile}`,
      `_amx:checkOutdated "${targetFile}" "${sourceFile}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 0);
    this.execute();
  }
  checkOutdatedTargetIsNewest() {
    let sourceFile = TMP_DIR + '/source'
    let targetFile = TMP_DIR + '/target'

    this.postActions(
      `echo 'data' > ${sourceFile}`,
      'sleep 1s',
      `echo 'data' > ${targetFile}`,
      //script tests abort when encountering exitCode!=0, but the next command is expected to be 1
      //so we must disable the auto-fail again
      'set +e',
      `_amx:checkOutdated "${targetFile}" "${sourceFile}"`,
      'outdatedResult="$?"'
    )
    this.verifyVariable('outdatedResult', 1);
    this.execute();
  }
}

runTestClass(AmxLibTest, FILE_UNDER_TEST)