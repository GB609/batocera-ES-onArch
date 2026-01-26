// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/logging.shl';

class LoggingTest extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    // default preActions contains test-compatible reimplementations of the log functions
    // they need to be removed or the real functions won't be declared 
    this.preActions = [
      'set -e',
      'exec 3>&2',
      'LOGFILE='
    ];
    this.arguments(`${this.TMP_DIR}/shell.log`);
    this.verifyFunction('exec');
    this.environment({ NO_LC: true });
  }

  static exitStatusIsKept = parameterized(
    ['_logOnly', '_logAndOut', '_logAndOutWhenDebug'],
    function(testFun) {
      this.environment({ PRINT_DEBUG: true });
      this.preActions.push('set +e');
      this.postActions(`( exit 42 ) || ${testFun} "Error: $?"`);
      assert.throws(() => this.execute());
      assert.equal(this.result.status, 42);
      assert.ok(this.result.stderr.startsWith('Error: 42\n'));
    }
  );

  failsWithoutLogArgument() {
    delete this.functionVerifiers.exec;
    this.arguments();
    assert.throws(() => this.execute(), /Failed with no output!/);
  }

  _logOnly() {
    this.verifyFunction('echo', "Hello, this has blanks plus something false");
    this.postActions('_logOnly "Hello, this has blanks %%1%% %%2%% %%3%%" plus something false');
    this.execute();
  }

  _logAndOut() {
    this.verifyFunction('_logOnly', "Hello, this has blanks %%1%%", "plus something false");
    this.verifyFunction('echo', "Hello, this has blanks plus something false");
    this.postActions(
      this.functionVerifiers._logOnly,
      '_logAndOut "Hello, this has blanks %%1%%" "plus something false"'
    );
    this.execute();
  }

  _logAndOutWhenDebug_DISABLED() {
    this.environment({ PRINT_DEBUG: '' });
    this.postActions(
      '_logAndOutWhenDebug "Hello, this has blanks" plus something false'
    );
    this.execute();
  }

  _logAndOutWhenDebug_ENABLED() {
    this.environment({ PRINT_DEBUG: true });
    this.verifyFunction('_logOnly', "Hello, this has blanks %%1%%", "plus something false");
    this.verifyFunction('echo', "Hello, this has blanks plus something false");
    this.postActions(
      this.functionVerifiers._logOnly,
      '_logAndOutWhenDebug "Hello, this has blanks %%1%%" "plus something false"'
    );
    this.execute();
  }

  _pipeDebugLog_DISABLED() {
    this.environment({ PRINT_DEBUG: '' });
    this.verifyFunction('cat');
    this.postActions('echo "output test" | _pipeDebugLog');
    this.execute();
  }

  _pipeDebugLog_ENABLED() {
    this.environment({ PRINT_DEBUG: 'notEmpty' });
    this.verifyFunction('tee', '-a', `${this.TMP_DIR}/shell.log`);
    this.postActions('echo "output test" | _pipeDebugLog');
    this.execute();
  }

  _callstack() {
    // remove the test implementation of _callstack provided by ShellTestRunner
    this.preActions.push('unset -f _callstack');
    let testScript = this.TMP_DIR + '/stacktest.sh';
    let testSource = `first () { 
        second 
      }
      second () { 
        third 
      }
      third () { 
        _callstack "Error happened here!" 
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


runTestClass(LoggingTest);