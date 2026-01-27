// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/emulatorlauncher/lib/value-transformations.shl';

const TRUE_VALUES = ['on', 'yes', 'true', 1];
//basically anything which is not true, could by any random string
const FALSE_VALUES = ['off', 'no', 'false', 0, 'randomGarbage'];

class ValueTransformationTests extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
  }

  static booleanTransformations = parameterized([
    ['on_off', 'on', 'off'],
    ['true_false', 'true', 'false'],
    ['yes_no', 'yes', 'no']
  ], function(transformer, trueValue, falseValue) {
    TRUE_VALUES.forEach(t => {
      let varName = `VAL_${t}`
      this.postActions(`${varName}=$(${transformer} "${t}")`);
      this.verifyVariable(varName, trueValue);
    });
    FALSE_VALUES.forEach(f => {
      let varName = `VAL_${f}`
      this.postActions(`${varName}=$(${transformer} "${f}")`);
      this.verifyVariable(varName, falseValue);
    });
    this.execute();
  })

  static caseTransformations = parameterized([
    ['cAmElCased', 'camelcased', 'CAMELCASED'],
    //umlauts in properties shouldn't really happen, but might be used for messages etc. Basically only used to check if none-us-ascii chars work
    //['ÄÖÜ', 'äöü', 'ÄÖÜ'], FIXME: locale dependency sucks
    ['0123456789', '0123456789', '0123456789'],
    //['Mixed5Ähö', 'mixed5ähö', 'MIXED5ÄHÖ'], FIXME: locale dependency sucks
    ['+-_:;/\\\\', '+-_:;/\\\\', '+-_:;/\\\\']
  ], function(input, lower, upper) {
    this.postActions(
      `LOWER=$(lower "${input}")`,
      `UPPER=$(upper "${input}")`,
    );
    this.verifyVariables({
      LOWER: lower,
      UPPER: upper
    });
    this.execute();
  })
}

runTestClasses(FILE_UNDER_TEST, ValueTransformationTests)
