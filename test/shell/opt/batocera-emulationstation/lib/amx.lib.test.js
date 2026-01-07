const fs = require('node:fs');

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/amx.lib'

const CACHE_DIR = TMP_DIR + '/.cache/emulationstation';
const AMX_PID_FILE = TMP_DIR + '/amx.state';
const GUIDE_PROFILE = `${process.env.SRC_DIR}/etc/batocera-emulationstation/controller-profiles/GUIDE.gamecontroller.amgp`;

class AmxLibTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      CONFIG_ROOT: process.env.SRC_DIR + '/etc/batocera-emulationstation',
      XDG_RUNTIME_DIR: this.TMP_DIR,
      ES_CACHE_DIR: CACHE_DIR
    });
    LOGGER.info("TMP_DIR is:", this.TMP_DIR);
  }

  guideMode() {
    this.verifyFunction(
      '_amx:restart',
      '--hidden', '--tray', '--profile',
      GUIDE_PROFILE
    );
    this.postActions('_amx:guideMode');
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
    this.verifyFunction('_checkOutdated', { code: 0 })

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

  checkOutdatedSourceIsNewer() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.verifyFunction('_checkOutdated', { code: 0 }, targetFile, sourceFile);
    this.verifyExitCode(`_amx:checkOutdated "${targetFile}" "${sourceFile}"`, true);
    this.execute();
  }
  checkOutdatedTargetIsNewest() {
    let sourceFile = this.TMP_DIR + '/source'
    let targetFile = this.TMP_DIR + '/target'

    this.verifyFunction('_checkOutdated', { code: 1 }, targetFile, sourceFile);
    this.verifyExitCode(`_amx:checkOutdated "${targetFile}" "${sourceFile}"`, false);
    this.execute();
  }
}

runTestClass(AmxLibTest, FILE_UNDER_TEST)
