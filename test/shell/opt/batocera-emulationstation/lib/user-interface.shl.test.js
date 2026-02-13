// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-interface.shl';

class CommonUtilsTests extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.verifyFunction('tty', { code: 0 });
    this.environment({ HOME: process.env.ES_HOME });
  }

  resultOut() {
    this.postActions('ui#resultOut ABC');
    this.disallowFunction('echo', false);
    this.postActions(
      'declare TEST_RESULT=',
      'use_var=TEST_RESULT ui#resultOut 123'
    );
    this.verifyFunction('echo', '-n', 'ABC');
    this.verifyVariable('TEST_RESULT', 123);
    this.execute();
  }

  captureAsReply() {
    this.postActions(
      'function modifyEnvironment { SOME_TEST_VAR=609; }',
      'ui#captureAsReply modifyEnvironment',
      'ui#captureAsReply builtin echo -e "ABC\\nsecond line"',
    );
    this.verifyVariables({
      SOME_TEST_VAR: 609,
      REPLY: 'ABC\nsecond line'
    });
    this.execute();
  }

  /** Make sure that an empty (=no) output also changes REPLY */
  captureAsReplyEmptyResult() {
    this.environment({ REPLY: "not empty string" });
    this.postActions('ui#captureAsReply :');
    this.verifyVariable('REPLY', '');
    this.execute();
  }
}

class TerminalInteractionTests extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.verifyFunction('tty', { code: 0 });
    this.environment({ HOME: process.env.ES_HOME });
  }

  verifyInterfaceStyle() {
    this.verifyVariable('ui__interfaceBackend', 'TTY');
    this.execute();
  }

  useUITest() {
    this.verifyExitCode('ui#isGraphical', false, 'UI_FLAG_SET');
    this.execute();
  }

  _ask() {
    this.postActions('RESULT="$(echo "user input" | ui ask)"');
    this.verifyVariable('RESULT', "user input");
    this.execute();
  }

  _confirmOk() {
    this.verifyExitCode('(echo "y" | ui requestConfirmation)', true, 'CONFIRM_OK');
    this.execute();
  }

  _confirmNOk() {
    this.verifyExitCode('(echo "n" | ui requestConfirmation)', false, 'CONFIRM_OK');
    this.execute()
  }
}

class UiInteractionTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.verifyFunction('tty', { code: 1 });
    this.environment({ HOME: process.env.ES_HOME, DISPLAY: ":0" });
  }

  verifyInterfaceStyle() {
    this.verifyVariable('ui__interfaceBackend', 'GUI');
    this.execute();
  }

  useUITest() {
    this.verifyExitCode('ui#isGraphical', true, 'UI_FLAG_SET');
    this.execute();
  }

  _confirmOk() {
    this.verifyFunction('ui#baseDialog', { code: 0, out: 'y' })
    this.postActions(
      this.functionVerifiers['ui#baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', true, 'CONFIRM_OK');
    this.execute()
  }

  _confirmNOk() {
    this.verifyFunction('ui#baseDialog', { code: 1, out: 'n' })
    this.postActions(
      this.functionVerifiers['ui#baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', false, 'CONFIRM_OK');
    this.execute()
  }
}

runTestClasses(FILE_UNDER_TEST, CommonUtilsTests, TerminalInteractionTests, UiInteractionTest);
