// SPDX-FileCopyrightText: 2026 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

// the 'real' tested file is 'gui.shl', but it's not fully functional on its own
const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/user-interface.shl';

class UiInteractionTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.verifyFunction('tty', { code: 1 });
    this.environment({ HOME: process.env.ES_HOME, DISPLAY: ":0" });
  }

  verifyBackendStyle() {
    this.verifyVariable('ui__interfaceBackend', 'GUI');
    this.verifyExitCode('ui#isGraphical', true, 'UI_FLAG_SET');
    this.execute();
  }

  confirmOk() {
    this.verifyFunction('ui#baseDialog', { code: 0, out: 'y' })
    this.postActions(
      this.functionVerifiers['ui#baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', true, 'CONFIRM_OK');
    this.execute()
  }

  confirmNOk() {
    this.verifyFunction('ui#baseDialog', { code: 1, out: 'n' })
    this.postActions(
      this.functionVerifiers['ui#baseDialog']
    );
    this.verifyExitCode('ui:requestConfirmation', false, 'CONFIRM_OK');
    this.execute()
  }
}

runTestClasses(FILE_UNDER_TEST, UiInteractionTest);
