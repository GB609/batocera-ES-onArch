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

  verifyIAHStyle() {
    this.verifyVariable('_IAH_STYLE', 'TTY');
    this.execute();
  }

  useUITest() {
    this.verifyExitCode('_useUI', false, 'UI_FLAG_SET');
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

  verifyIAHStyle() {
    this.verifyVariable('_IAH_STYLE', 'UI');
    this.execute();
  }

  useUITest() {
    this.verifyExitCode('_useUI', true, 'UI_FLAG_SET');
    this.execute();
  }

  _confirmOk() {
    this.verifyFunction('ui:baseDialog', { code: 0 })
    this.postActions(
      this.functionVerifiers['ui:baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', true, 'CONFIRM_OK');
    this.execute()
  }

  _confirmNOk() {
    this.verifyFunction('ui:baseDialog', { code: 1 })
    this.postActions(
      this.functionVerifiers['ui:baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', false, 'CONFIRM_OK');
    this.execute()
  }
}

runTestClasses(FILE_UNDER_TEST, TerminalInteractionTests, UiInteractionTest)
