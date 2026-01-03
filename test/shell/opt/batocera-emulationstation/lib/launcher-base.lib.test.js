const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/launcher-base.lib';

const EXPECTED_HELP = `--- Usage: ---
  bash <action> <rom> [-cfg sourceable/config/file] [-- args for final executable]

--- Supported Actions: ---
 <action>: one of (testFunc run help)
 * testFunc: A test text action!
 * run <rom>: start <rom> directly
 * help: Print this text.

--- Supported File Types: ---
 dir test 

--- [-cfg sourceable/config/file]: ---
A file that must be sourceable by bash. Provides properties needed to launch the rom.
when no -cfg is given, this script will request config from emulatorlauncher to assure necessary args are set up correctly.
`;

class LauncherBaseApiTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      FS_ROOT: process.env.SRC_DIR,
      //absRomPath is normally provided by emulatorlauncher
      absRomPath: '/ABC.test'
    });
    this.preActions.push(
      `echo 'declare -g "TEST=true"' > ${this.TMP_DIR}/props.sh`,
    );
    this.postActions(
      'SUPPORTED_ACTIONS+=(testFunc)',
      'ACTION_HELP[testFunc]="testFunc: A test text action!"',
      'SUPPORTED_TYPES+=(dir test)'
    );
  }

  fileTypeGroups() {
    this.environment({ absRomPath: '/ABC.folder' });
    this.preActions.push(`set -- run /ABC.folder -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_dir');
    this.verifyFunction('run');

    this.postActions(
      'TYPE_GROUPS[folder]=dir',
      'main'
    );
    this.execute();
  }

  printHelp() {
    this.preActions.push('set --');
    this.postActions('main');
    assert.throws(() => this.execute());

    assert.equal(this.result.stdout, EXPECTED_HELP);
  }

  postConfig() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_test');
    this.verifyFunction('_postConfig');
    this.verifyFunction('run');
    this.postActions('main');
    this.execute();
  }

  renameActionHandler() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_test');
    this.verifyFunction('testRunHandler');
    this.postActions(
      'ACTION_EXEC[run]=testRunHandler',
      'main'
    );

    this.execute();
  }

  preparePrefixDir(){
    assert.fail('missing test for hook function [_preparePrefixDir]');
  }

  overlayLowerDirs(){
    assert.fail('missing test for hook function [_ofsLowerDirs]');
  }

  readGameConfig(){
    assert.fail('missing test for hook function [_readGameConfig]');
  }
}

class LauncherBaseFeatureTest extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      FS_ROOT: process.env.SRC_DIR,
      absRomPath: '/ABC.test'
    });
    this.preActions.push(
      `echo 'declare -g "TEST=true"' > ${this.TMP_DIR}/props.sh`,
    );
    this.postActions(
      'SUPPORTED_ACTIONS+=(testFunc)',
      'ACTION_HELP[testFunc]="testFunc: A test text action!"',
      'SUPPORTED_TYPES+=(dir test)'
    );
  }

  handleArgs() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh" -- some more args`);
    this.verifyFunction('run');
    this.verifyFunction('handleType_test');
    this.verifyVariables({
      'ARGS': ['some', 'more', 'args'],
    });

    this.postActions('main');
    this.execute();
  }

  noFileEnding() {
    this.environment({ absRomPath: '/ABC' });
    this.preActions.push(
      `set -- run /ABC -cfg "${this.TMP_DIR}/props.sh"`,
      'run() { echo "must be declared but not verified, because never called"; }'
    );
    this.verifyExitCode('main', false);

    this.throwOnError = false;
    this.execute();
    assert.equal(this.result.stderr, 'ERROR: Target file has no recognizable ending.\n');
  }

  unsupportedFileType() {
    this.preActions.push(
      `set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`,
      'run() { echo "must be declared but not verified, because never called"; }'
    );
    this.throwOnError = false;
    this.postActions('main');

    this.execute();
    assert.equal(this.result.stderr, "ERROR: test not supported yet\n");
  }

  codingError_unsupportedAction() {
    this.preActions.push('set -- testFunc');
    this.postActions('main');
    assert.throws(() => this.execute());

    assert.equal(this.result.stderr, 'ERROR: Action [testFunc] not supported!\n');
  }


  exitHooks() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_test');
    this.verifyFunction('_runExitHooks');
    this.verifyFunction('run');
    this.postActions(
      this.functionVerifiers['_runExitHooks'],
      'main'
    );
    this.execute();
  }
}

runTestClasses(FILE_UNDER_TEST, LauncherBaseApiTest, LauncherBaseFeatureTest)
