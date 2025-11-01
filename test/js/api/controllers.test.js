/**
 * @file
 * This test file verifies the behaviour of functions in `btc-config` which are related to controllers:
 * - `applyGuideProfile <baseProfile>` 
 */

Object.assign(globalThis, require('test-helpers.mjs'));
enableLogfile();

const assert = require('node:assert/strict');
const logger = require('config.libs/logger.js');
const parsing = require('config.libs/parsing.js');

const TEST_RESOURCE_ROOT = ROOT_PATH + "/test/resource/fs_root";
const CONFIG_ROOT = process.env.SRC_DIR + '/etc'
const BTC_BIN_DIR = TEST_RESOURCE_ROOT + "/btcDir/bin";

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.CONFIG_ROOT = CONFIG_ROOT;

//need import to get function defined on API into globalThis
const btc = require('btc-config');
const controllers = require('config.libs/controllers.js');
const { LogCollector, ProcessOutput } = new require('../utils/output-capturing.js');

const EMPTY_PROFILE = TEST_RESOURCE_ROOT + '/configs/controller-profiles/EMTPY.gamecontroller.amgp';

const GUIDE_BTN_DEF = {
  '@index': 6,
  setselect: 8,
  setselectcondition: 'one-way',
  actionname: 'OS Menu',
  slots: [
    {
      slot: [
        {
          code: '0x1000022',
          mode: 'keyboard'
        }
      ]
    }
  ]
}

function assertGuideButton(testSet) {
  let setIndex = testSet['@index'];
  let guideButton = testSet.button.find(b => b['@index'] == 6)
  assert.notEqual(guideButton, null, `There should be a guide button in set ${setIndex}!`)
  assert.deepEqual(guideButton, GUIDE_BTN_DEF, `Set ${setIndex} guide button definition incorrect!`);
}

class BtcControllerTests {
  static logCollector = new LogCollector();

  static beforeAll() {
    this.logCollector.patchLogger('btc-config', [
      logger.Level.USER,
      logger.Level.ERROR,
      logger.Level.API
    ], true);
  }

  static afterAll() { this.logCollector.restoreLoggerConfig() }

  beforeEach() { BtcControllerTests.logCollector.reset() }

  apiErrorWhenNoBase() {
    let output = ProcessOutput.captureFor(() => API.applyGuideProfile());

    assert.equal(output.error, "requires 1 arguments");
    assert.equal(output.out.capturedByWrite, '');
    assert.equal(output.out.writtenToHandle, '');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }

  apiErrorWhenNoValidBaseFile() {
    let output = ProcessOutput.captureFor(() => API.applyGuideProfile('abcdef'));

    assert.equal(output.error, "abcdef: <abcdef> does not exist\nrequires 1 arguments");
    assert.equal(output.out.capturedByWrite, '');
    assert.equal(output.out.writtenToHandle, '');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }

  addGuideButton() {
    let result = sanitizeDataObject(controllers.applyGuideProfile(EMPTY_PROFILE, { '--name': 'TEST' }));

    let sets = result.gamecontroller[0].sets[0].set;
    assert.equal(sets.length, 2, "merged gamecontroller xml should have 2 sets");

    let firstSet = sets.find(set => set['@index'] == 1);
    assert.equal(firstSet.button.length, 1);

    assertGuideButton(firstSet);
  }

  overwriteGuideButton() {
    const buttonDef = {
      '@index': 6,
      'actionname': 'something else',
      slots: []
    };

    let patchedEmptyProfile = parsing.xmlToDict(EMPTY_PROFILE);
    patchedEmptyProfile.gamecontroller.sets = {
      set: []
    }
    let setList = patchedEmptyProfile.gamecontroller.sets.set;
    for (let i = 1; i < 5; i++) {
      setList.push({
        '@index': i,
        button: Object.assign({}, buttonDef)
      })
    }

    let result = sanitizeDataObject(controllers.applyGuideProfile(patchedEmptyProfile, { '--name': 'TEST' }));
    setList = result.gamecontroller[0].sets[0].set;
    setList.filter(s => s['@index'] != 8).forEach(assertGuideButton);
  }

  addSet8() {
    let result = sanitizeDataObject(controllers.applyGuideProfile(EMPTY_PROFILE, { '--name': 'TEST' }));

    let sets = result.gamecontroller[0].sets[0].set;
    assert.equal(sets.length, 2, "merged gamecontroller xml should have 2 sets");

    let lastSet = sets.find(set => set['@index'] == 8);
    assert.equal(lastSet.name, "Menu Navigation");
  }

  overwriteSet8() {
    const buttonDef = {
      '@index': 6,
      'actionname': 'something else',
      slots: []
    };

    let patchedEmptyProfile = parsing.xmlToDict(EMPTY_PROFILE);
    patchedEmptyProfile.gamecontroller.sets = {
      set: [{
        '@index': 8,
        'name': 'dummySet',
        button: Object.assign({}, buttonDef)
      }]
    }

    let result = sanitizeDataObject(controllers.applyGuideProfile(patchedEmptyProfile, { '--name': 'TEST' }));
    let setList = result.gamecontroller[0].sets[0].set;

    let lastSet = setList.find(set => set['@index'] == 8);
    assert.equal(lastSet.name, "Menu Navigation");
  }

  mergedProfileWrittenToOut() {
    let output = ProcessOutput.captureFor(() => API.applyGuideProfile(EMPTY_PROFILE, '--name', 'TEST'));

    assert.equal(output.error, undefined);
    assert.equal(output.out.capturedByWrite, '');
    assert.ok(output.out.writtenToHandle.length > 0, 'There should be output to process.stdout!');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }
  
  profileImageProperties(){
    let testFile = ROOT_PATH + '/sources/fs-root/etc/batocera-emulationstation/controller-profiles/rpg.gamecontroller.amgp';
    let targetDir = `${TMP_DIR}/controller-svg`;
    controllers.profileToImage(testFile, targetDir);
  }
}

runTestClass(BtcControllerTests)