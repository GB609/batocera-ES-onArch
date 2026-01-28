// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-interface.shl';

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
    this.postActions(`source "$SH_LIB_DIR"/generic-utils.shl`)
  }

  static formApiImplemented = parameterized([
    'ui:requestConfirmation', 'ui:ask', 'ui:askChoice', 'ui:askDirectory', 'ui:askFile'
  ], function(uiFunction) {
    this.verifyFunction('ui#isTX', { code: 0 })
    this.postActions(
      this.functionVerifiers['ui#isTX'],
      'function ui#baseDialog { _printException "Should not be called in TX mode!" >&2; exit 1; }',
      `use_var=ABC ${uiFunction} 'Answer?'`
    );
    this.execute();
  })

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

runTestClasses(FILE_UNDER_TEST, TerminalInteractionTests, UiInteractionTest)
