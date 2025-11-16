Object.assign(globalThis, require('test-helpers.mjs'));
const assert = require('node:assert/strict');
const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/interaction_helpers.lib';

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
    this.postActions('_useUI && UI_FLAG_SET=true || UI_FLAG_SET=false');
    this.verifyVariable('UI_FLAG_SET', false);
    this.execute();
  }

  _ask() {
    this.postActions('RESULT="$(echo "user input" | _ask)"');
    this.verifyVariable('RESULT', "user input");
    this.execute();
  }

  _confirmOk() {
    this.postActions(
      '(echo "y" | _confirm) && CONFIRM_OK="true" || CONFIRM_OK="false"'
    );
    this.verifyVariable('CONFIRM_OK', true);
    this.execute()
  }

  _confirmNOk() {
    this.postActions(
      '(echo "n" | _confirm) && CONFIRM_OK="true" || CONFIRM_OK="false"'
    );
    this.verifyVariable('CONFIRM_OK', false);
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
    this.postActions('_useUI && UI_FLAG_SET=true || UI_FLAG_SET=false');
    this.verifyVariable('UI_FLAG_SET', true);
    this.execute();
  }

  _confirmOk() {
    this.verifyFunction('_interface:baseDialog', { code: 0 })
    this.postActions(
      this.functionVerifiers['_interface:baseDialog'],
      '_confirm && CONFIRM_OK="true" || CONFIRM_OK="false"'
    );
    this.verifyVariable('CONFIRM_OK', true);
    this.execute()
  }

  _confirmNOk() {
    this.verifyFunction('_interface:baseDialog', { code: 1 })
    this.postActions(
      this.functionVerifiers['_interface:baseDialog'],
      '_confirm && CONFIRM_OK="true" || CONFIRM_OK="false"'
    );
    this.verifyVariable('CONFIRM_OK', false);
    this.execute()
  }
}

runTestClasses(FILE_UNDER_TEST, TerminalInteractionTests, UiInteractionTest)