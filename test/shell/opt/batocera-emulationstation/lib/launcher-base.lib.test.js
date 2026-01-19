// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

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

  overlayLowerDirs() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('_ofsLowerDirs', { exec: 'OVERLAY_LAYERS+=(/TEST)' });
    this.verifyFunction('_delayerUserSave');

    let gamePrefix = this.TMP_DIR + "/prefix";
    let saveDir = this.TMP_DIR + "/saves";
    let template = this.TMP_DIR + "/template";

    // paths defined by the shell script
    let workDir = saveDir + "/workdir";
    let saveData = saveDir + '/save_data';

    this.environment({
      GAME_PREFIX: gamePrefix,
      GAME_SAVE_DIR: saveDir,
      _templatePrefix: template,
    });

    let expectedLower = `${template}:/TEST`;
    let overlayArg = `lowerdir=${expectedLower},upperdir=${saveData},workdir=${workDir}`
    this.verifyFunction('fuse-overlayfs', '-o', overlayArg, gamePrefix);
    this.verifyVariable('EXIT_HOOKS', [`_delayerUserSave '${saveDir}'`]);

    this.postActions(
      'mkdir "$_templatePrefix"',
      '_initUserFromLib'
    );

    this.execute();
  }

  /** test includes check for '_preparePrefixDir' and '_readGameLaunchConfig' */
  setupPrefix() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_test');
    this.verifyFunction('_preparePrefixDir');
    this.verifyFunction('_readGameLaunchConfig');
    this.verifyFunction('date', { exec: 'command date' });
    this.postActions(
      `run() { _setupPrefix "${this.TMP_DIR}"; }`,
      'main'
    );
    this.execute();
  }

  setupPrefix_initialisedAlready() {
    this.preActions.push(`set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`);
    this.verifyFunction('handleType_test');
    // used by batocera-paths.lib
    this.verifyFunction('mkdir');
    this.disallowFunction('_preparePrefixDir');
    this.disallowFunction('date');
    this.postActions(
      //fake prefix marker
      `touch "${this.TMP_DIR}"/.initialised`,
      `run() { _setupPrefix "${this.TMP_DIR}"; }`,
      'main'
    );
    this.execute();
  }
}

class LauncherBaseFeatureTest extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      FS_ROOT: process.env.SRC_DIR
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
      `set -- run /ABC.unsup -cfg "${this.TMP_DIR}/props.sh"`,
      'run() { echo "must be declared but not verified, because never called"; }'
    );
    this.throwOnError = false;
    this.postActions('main');

    this.execute();
    assert.equal(this.result.stderr, "ERROR: unsup not supported yet\n");
  }

  codingError_unsupportedAction() {
    this.preActions.push('set -- testFunc');
    this.postActions('main');
    assert.throws(() => this.execute());

    assert.equal(this.result.stderr, 'ERROR: Action [testFunc] not supported!\n');
  }

  codingError_noTypeHandler() {
    this.preActions.push(
      `set -- run /ABC.test -cfg "${this.TMP_DIR}/props.sh"`,
      'unset -f handleType_test'
    );
    this.verifyFunction('run');
    this.postActions('main');
    assert.throws(() => this.execute());

    assert.equal(this.result.stderr, 'ERROR: Coding-Error: No type handler for test:test\n');
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

  static templatePrefixVerificationsForUser = parameterized([
    ['/not/existing', "_initUserFromLib requires a template prefix, but was given '/not/existing'"],
    ['/usr', 'ERROR: Not a valid _templatePrefix: [/usr]'],
    [
      process.env.ES_HOME, 
      `ERROR: Overlay not possible: [${process.env.ES_HOME}/saves] is a sub-directory of [${process.env.ES_HOME}]`
    ]
  ], function(testPath, expectedError) {
    this.environment({
      _templatePrefix: testPath,
      GAME_SAVE_DIR: testPath + '/saves',
      GAME_PREFIX: testPath + '/pfx'
    });
    this.postActions(
      'fuse-overlayfs() { echo STUBBED; }',
      '_initUserFromLib'
    );

    this.throwOnError = false;
    this.execute();
    let errLines = this.result.stderr.trim().split('\n');
    assert.equal(errLines[0], expectedError);
  })

  dynamicPrefixSelection_noFolder() {
    this.disallowFunction('_libraryPrefix');
    this.verifyFunction('_userPrefix');
    this.postActions('_dynamicSelectPrefix');

    this.execute();
  }

  dynamicPrefixSelection_invalidType() {
    this.environment({
      absRomPath: this.TMP_DIR,
      PREFIX_TYPE: 'ABC'
    });
    this.throwOnError = false;
    this.postActions('_dynamicSelectPrefix');

    this.execute();
    assert.equal(this.result.stderr, "ERROR: [ABC] is not a valid prefix target type (valid: user, lib)\n");
  }

  static dynamicPrefixSelection_library = parameterized(
    [
      [{ PREFIX_TYPE: '--lib' }, [], ''],
      [{ PREFIX_TYPE: '--lib' }, ['--user'], ''],
      [{ PREFIX_TYPE: '' }, ['--lib'], '--user'],
      [{ PREFIX_TYPE: '--lib' }, ['--user'], '--user'],
      [{ PREFIX_TYPE: '' }, [''], '--lib']
    ],
    function(env, launcherArgs, funcArgs) {
      this.environment({ absRomPath: this.TMP_DIR });
      this.environment(env);
      this.verifyFunction('_libraryPrefix');
      this.disallowFunction('_userPrefix');
      this.postActions(
        `ARGS=(${launcherArgs.join()})`,
        `_dynamicSelectPrefix ${funcArgs}`
      );

      this.execute();
    }
  )

  static dynamicPrefixSelection_user = parameterized(
    [
      [{ PREFIX_TYPE: '--user' }, [], ''],
      [{ PREFIX_TYPE: '--user' }, ['--lib'], ''],
      [{ PREFIX_TYPE: '' }, ['--user'], '--lib'],
      [{ PREFIX_TYPE: '--user' }, ['--lib'], '--lib'],
      [{ PREFIX_TYPE: '' }, [''], '--user']
    ],
    function(env, launcherArgs, funcArgs) {
      this.environment({ absRomPath: this.TMP_DIR });
      this.environment(env);
      this.disallowFunction('_libraryPrefix');
      this.verifyFunction('_userPrefix');
      this.postActions(
        `ARGS=(${launcherArgs.join()})`,
        `_dynamicSelectPrefix ${funcArgs}`
      );

      this.execute();
    }
  )
}

runTestClasses(FILE_UNDER_TEST, LauncherBaseApiTest, LauncherBaseFeatureTest)
