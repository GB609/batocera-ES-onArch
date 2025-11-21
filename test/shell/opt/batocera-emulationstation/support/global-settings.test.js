const fs = require('node:fs');
const { execSync } = require('node:child_process')

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/support/global-settings'

const BTC_CONFIG_ROOT = process.env.TEST_FS + '/configs'
const BTC_BIN_DIR = process.env.TEST_FS + "/btcDir/bin";

const settingsScript = ROOT_PATH + '/sources/fs-root/' + FILE_UNDER_TEST;

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.BTC_CONFIG_ROOT = BTC_CONFIG_ROOT;
process.env.DROPIN_PATH = BTC_CONFIG_ROOT + '/dropins';
process.env.PATH = `${SRC_PATH}:${process.env.PATH}`

//need import to get function defined on API into globalThis
const btc = require('btc-config');
const { ProcessOutput } = require('js/utils/output-capturing.js');

class GlobalSettingsTest {

  getUnfilteredListAllDefaults() {
    let expected = [
      'controllers.bluetooth.enabled=1',
      'controllers.db9.args=map=1',
      'controllers.gpio.enabled=0',
      'controllers.ps3.enabled=1',
      'controllers.xarcade.enabled=1',
      'global.shaderset=none',
      'global.tdp=0',
      'global.videomode=CEA 4 HDMI',
      'system.hostname=BATOCERA',
      'system.kbvariant=nodeadkeys'
    ].join('\n');

    let actual = execSync(`${settingsScript} get`, { encoding: 'utf8' });
    assert.equal(actual.trim(), expected);

    actual = ProcessOutput.captureFor(() => API.effectiveGlobals('get'));
    assert.equal(actual.out.writtenToHandle.trim(), expected);
  }

  getOneProperty() {
    let actual = execSync(`${settingsScript} get system.kbvariant`, { encoding: 'utf8' });
    assert.equal(actual.trim(), 'nodeadkeys');

    actual = API.effectiveGlobals('get', 'system.kbvariant');
    assert.equal(`${actual}`, 'nodeadkeys');
  }

  getWithFilter() {
    let expected = [
      'global.shaderset=none',
      'global.tdp=0',
      'global.videomode=CEA 4 HDMI'
    ].join('\n');

    let actual = execSync(`${settingsScript} get --filter global`, { encoding: 'utf8' });
    assert.equal(actual.trim(), expected);
  }

  setFails() { assert.throws(() => execSync(`${settingsScript} set`, { encoding: 'utf8' }), /`set` requires key and value arguments/) }
}

runTestClass(GlobalSettingsTest);