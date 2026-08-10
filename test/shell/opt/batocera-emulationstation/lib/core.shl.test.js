// SPDX-FileCopyrightText: 2026 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');
const { relative } = require('node:path');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/core.shl';

class CoreTest extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({ NO_LC: true });
  }

  addsSelfImportCorrectly() {
    this.verifyVariable('__BTCSH_IMPORTED_FILES', { [this.fileUnderTest]: true });
    this.execute();
  }

  ["core:callstack"]() {
    let testScript = relative(ROOT_PATH, this.TMP_DIR) + '/stacktest.sh';
    // remove the test redirection of callstack via 'core__callstackHandler' done in ShellTestRunner
    this.preActions.push('unset core__callstackHandler')
    let testSource = `first () { 
        second 
      }
      second () { 
        third 
      }
      third () { 
        core:callstack "Error happened here!" 
      }`;

    let write = require('node:fs').writeFileSync;
    write(testScript, testSource, { flag: 'a' });
    this.postActions(
      `source "${testScript}"`,
      'first'
    );

    this.execute();
    let expected = `Error happened here!
\tat third (${testScript}:8)
\tat second (${testScript}:5)
\tat first (${testScript}:2)
`;

    if (!this.result.stdout.startsWith(expected)) { assert.equal(this.result.stdout, expected); }
  }
}


runTestClass(CoreTest);