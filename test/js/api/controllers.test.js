// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

/**
 * @file
 * This test file verifies the behaviour of functions in `btc-config` which are related to controllers:
 * - `controller:applyGuide <baseProfile>` 
 * - `controller:createImages <sourceProfile>`
 */

enableLogfile();

const logger = require('logger');
const parsing = require('io/parsers');

const TEST_RESOURCE_ROOT = ROOT_PATH + "/test/resource/fs_root";
const CONFIG_ROOT = process.env.SRC_DIR + '/etc/batocera-emulationstation'
const BTC_BIN_DIR = TEST_RESOURCE_ROOT + "/btcDir/bin";

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.CONFIG_ROOT = CONFIG_ROOT;

//need import to get function defined on API into globalThis
const btc = require('btc-config');
const controllers = require('controllers');
const { LogCollector, ProcessOutput } = new require('../utils/output-capturing');

const EMPTY_PROFILE = TEST_RESOURCE_ROOT + '/configs/controller-profiles/EMPTY.gamecontroller.amgp';

const GUIDE_BTN_DEF = {
  '@index': 6,
  setselect: 8,
  setselectcondition: 'one-way',
  actionname: 'OS Menu',
  slots: [
    {
      slot: [
        {
          arguments: '-c "os-menu show"',
          path: '/bin/sh',
          mode: 'execute'
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
  static APPLY_GUIDE_FN = 'controller:applyGuide';
  static logCollector = new LogCollector();
  static EMPTY_PARSED;

  static beforeAll() {
    this.logCollector.patchLogger('btc-config', [
      logger.Level.USER,
      logger.Level.ERROR,
      logger.Level.API
    ], true);

    this.EMPTY_PARSED = parsing.xmlToDict(EMPTY_PROFILE);
  }

  static afterAll() { this.logCollector.restoreLoggerConfig() }

  beforeEach() {
    this.EMPTY_PARSED = sanitizeDataObject(BtcControllerTests.EMPTY_PARSED);
    BtcControllerTests.logCollector.reset();
  }

  apiErrorWhenNoBase() {
    let output = ProcessOutput.captureFor(() => API[BtcControllerTests.APPLY_GUIDE_FN]());

    assert.equal(output.error, "requires 1 arguments");
    assert.equal(output.out.capturedByWrite, '');
    assert.equal(output.out.writtenToHandle, '');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }

  apiErrorWhenNoValidBaseFile() {
    let output = ProcessOutput.captureFor(() => API[BtcControllerTests.APPLY_GUIDE_FN]('abcdef'));

    assert.equal(output.error, "abcdef: <abcdef> does not exist\nrequires 1 arguments");
    assert.equal(output.out.capturedByWrite, '');
    assert.equal(output.out.writtenToHandle, '');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }

  addGuideButton() {
    let result = sanitizeDataObject(controllers.applyGuideProfile(this.EMPTY_PARSED, { '--name': 'TEST' }));

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

    let patchedEmptyProfile = this.EMPTY_PARSED;
    patchedEmptyProfile.gamecontroller.sets = { set: [] }
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
    let result = sanitizeDataObject(controllers.applyGuideProfile(this.EMPTY_PARSED, { '--name': 'TEST' }));

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

    let patchedEmptyProfile = this.EMPTY_PARSED;
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
    let output = ProcessOutput.captureFor(() => API[BtcControllerTests.APPLY_GUIDE_FN](EMPTY_PROFILE, '--name', 'TEST'));

    assert.equal(output.error, undefined);
    assert.equal(output.out.capturedByWrite, '');
    assert.ok(output.out.writtenToHandle.length > 0, 'There should be output to process.stdout!');
    assert.deepEqual(BtcControllerTests.logCollector.lineStrings, []);
  }

  profileImageProperties() {
    let testFile = ROOT_PATH + '/sources/fs-root/etc/batocera-emulationstation/controller-profiles/rpg.gamecontroller.amgp';
    let targetDir = `${TMP_DIR}/controller-svg`;
    controllers.profileToImage(testFile, targetDir);
  }
}

runTestClass(BtcControllerTests)