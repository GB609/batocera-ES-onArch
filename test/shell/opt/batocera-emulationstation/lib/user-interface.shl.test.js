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

  asReplyFromStdin() {
    this.postActions(
      //this function verifies that cmd given to asReply is not forked
      'function modifyEnvironment { SOME_TEST_VAR=609; }',
      'ui#asReply modifyEnvironment',
      'ui#asReply builtin echo -e "ABC\\nsecond line"',
    );
    this.verifyVariables({
      SOME_TEST_VAR: 609,
      REPLY: 'ABC\nsecond line'
    });
    this.execute();
  }

  /** ui#asReply should be able to inherit and propagate REPLY from cmd */
  asReplyFromVar() {
    this.postActions(
      'function setVar { REPLY=ABCD; }',
      'ui#asReply setVar'
    );
    this.verifyVariable('REPLY', 'ABCD');
    this.execute();
  }

  asReplyStdBeforeVar() {
    this.postActions(
      'function setVar { REPLY=ABCD; echo -n XYZ; }',
      'ui#asReply setVar'
    );
    this.verifyVariable('REPLY', 'XYZ');
    this.execute();
  }

  /** Make sure that an empty (=no) output also changes REPLY */
  asReplyEmptyResult() {
    this.environment({ REPLY: "not empty string" });
    this.postActions('ui#asReply :');
    this.verifyVariable('REPLY', '');
    this.execute();
  }

  verify_isDir() {
    this.verifyExitCode('ui#verify_isDir /bin', true);
    this.verifyExitCode('ADJUST=$(ui#verify_isDir /ABCDEF)', false);
    this.verifyVariable('ADJUST', '/');
    this.execute();
  }

  static fileTypeVerifications = parameterized([
    ['txt', 'testfile.txt', true],
    //file name valid, but does not exist
    ['txt', 'testfile.txt', false, false],
    ['bat', 'testfile.BAT', true],
    ['txt|m|bat', 'testfile.m', true],
    //ending appears, but not at end
    ['txt', 'testfile.txt.abc', false, true],
    //ending appears, but without literal '.'
    ['txt', 'testfiletxt', false, true],
  ], function(pattern, filename, valid, createFile = valid) {
    let filePath = `${this.TMP_DIR}/${filename}`;
    if (createFile) { this.postActions(`touch '${filePath}'`); }
    this.verifyExitCode(`ADJUST=$(ui#verify_isFileType '${pattern}' '${filePath}')`, valid);
    this.verifyVariable('ADJUST', valid ? filePath : this.TMP_DIR);
    this.execute();
  }, function names(defs, testFun, pattern, filename, valid, createFile = valid) {
    return `${valid ? 'OK' : 'NOK'}: /*.@(${pattern})$/ =~ ${filename}${createFile ? '' : ' ![-f]'}`
  });
}

class ApiTest extends ShellTestRunner {
  beforeEach(ctx) {
    super.beforeEach(ctx);

    this.testFile(FILE_UNDER_TEST);
    this.environment({
      HOME: process.env.ES_HOME,
      //disables sourcing of a 'proper' backend
      ui__interfaceBackend: 'test'
    });
  }

  /** Tests that the 'public' APIs use the backend-specific implementations internally */
  static ApitoImpl = parameterized([
    ['ui:requestConfirmation', 'ui#requestConfirmationImpl', { code: 0 }],
    ['ui:ask', 'ui#requestInputImpl', { out: 'blubb' }],
    ['ui:askChoice', 'ui#requestChoiceImpl', { out: 1 }],
    ['ui:askDirectory', 'ui#requestDirectoryImpl', { out: '/home' }],
    ['ui:askFile', 'ui#requestFileImpl', { out: '/home/.bashrc' }]
  ], function(api, impl, mockResponse) {
    this.verifyFunction(impl, mockResponse);
    this.postActions(`${api} 'Require input'`);
    this.execute();
  });
}

runTestClasses(FILE_UNDER_TEST, CommonUtilsTests, ApiTest);
