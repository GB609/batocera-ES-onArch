/**
 * @file
 * This test file verifies the behaviour of functions in `btc-config` which are related to controllers:
 * - `applyGuideProfile <baseProfile>` 
 */

Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');

enableLogfile();
const logger = require('config.libs/logger.js');

const TEST_RESOURCE_ROOT = ROOT_PATH + "/test/resource/fs_root";
const CONFIG_ROOT = process.env.SRC_DIR + '/etc'
const BTC_BIN_DIR = TEST_RESOURCE_ROOT + "/btcDir/bin";

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.CONFIG_ROOT = CONFIG_ROOT;

//need import to get function defined on API into globalThis
const btc = require('btc-config');
const { LogCollector, ProcessOutput } = new require('../utils/output-capturing.js');

const EMPTY_PROFILE = TEST_RESOURCE_ROOT + '/configs/controller-profiles/EMTPY.gamecontroller.amgp';

class BtcControllerApiTests {
  static logCollector = new LogCollector();

  static beforeAll() {
    this.logCollector.patchLogger('btc-config', [
      logger.Level.USER,
      logger.Level.ERROR,
      logger.Level.API
    ], true);
  }

  static afterAll() { this.logCollector.restoreLoggerConfig() }

  beforeEach() { BtcControllerApiTests.logCollector.reset() }
  
  testEqualizer(){
    let BTC_CONFIG_ROOT = require('config.libs/config-import').BTC_CONFIG_ROOT;
    let parser = require('config.libs/parsing.js').parseDict;
    let guideProfilePath = `${BTC_CONFIG_ROOT}/controller-profiles/GUIDE.gamecontroller.amgp`;
    
    let controllers = require('config.libs/controllers.js');
    let dict = parser(guideProfilePath);
    console.error("NATIVE: ", JSON.stringify(dict, null, 2));
    console.error("MAPPED", JSON.stringify(controllers.equalizeStructure(dict), null, 2));
    
    let writer = require('config.libs/output-formats.js').xml;
    writer.write(dict, process.stdout)
  }
/*
  errorWhenNoBase() {
    let output = ProcessOutput.captureFor(() => API.applyGuideProfile());

    assert.equal("requires 1 arguments", output.error);
    assert.equal('', output.out.capturedByWrite);
    assert.equal('', output.out.writtenToHandle);
    assert.deepEqual([], BtcControllerApiTests.logCollector.lineStrings);
  }

  errorWhenNoBaseFile() {
    let output = ProcessOutput.captureFor(() => API.applyGuideProfile('abcdef'));

    assert.equal("abcdef: <abcdef> does not exist\nrequires 1 arguments", output.error);
    assert.equal('', output.out.capturedByWrite);
    assert.equal('', output.out.writtenToHandle);
    assert.deepEqual([], BtcControllerApiTests.logCollector.lineStrings);
  }

  overwriteGuideButton() { }
  addGuideButton() {
    API.applyGuideProfile(EMPTY_PROFILE)
    /*let output = ProcessOutput.captureFor(() => API.applyGuideProfile(EMPTY_PROFILE));

    assert.equal('', output.error);
    assert.equal('', output.out.capturedByWrite);
    assert.equal('', output.out.writtenToHandle);
    assert.deepEqual([], BtcControllerApiTests.logCollector.lineStrings);
  }

  overwriteSet8() { }
  addSet8() { }*/
}

runTestClass(BtcControllerApiTests)