// SPDX-FileCopyrightText: 2026 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

// the 'real' tested file is 'tty.shl', but it's not fully functional on its own
const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-interface.shl';

class TerminalInteractionTests extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.verifyFunction('tty', { code: 0 });
    this.environment({ HOME: process.env.ES_HOME });
  }

  verifyBackendStyle() {
    this.verifyVariable('ui__interfaceBackend', 'TTY');
    this.verifyExitCode('ui#isGraphical', false, 'UI_FLAG_SET');
    this.execute();
  }

  ask() {
    this.postActions('RESULT="$(echo "user input" | ui ask)"');
    this.verifyVariable('RESULT', "user input");
    this.execute();
  }

  askDirectory() {
    this.postActions("RESULT=$(echo /var | ui askDirectory 'Enter dirname')");
    this.verifyVariable('RESULT', '/var');
    this.execute();
  }

  asDirectoryCancelAfterNotExistingDir() {
    //tty backend uses read -e, this does not work the same when stdin != tty
    this.verifyExitCode("(echo -e '/home/someunknownuser\\n' | ui askDirectory 'Enter dirname')", false, 'GET_DIR_OK');
    this.execute();
  }

  confirmOk() {
    this.verifyExitCode('(echo "y" | ui requestConfirmation)', true, 'CONFIRM_OK');
    this.execute();
  }

  confirmNOk() {
    this.verifyExitCode('(echo "n" | ui requestConfirmation)', false, 'CONFIRM_OK');
    this.execute()
  }
}

runTestClasses(FILE_UNDER_TEST, TerminalInteractionTests);
