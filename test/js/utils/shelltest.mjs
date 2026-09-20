// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { CoverageRecorder } from './coverage-recording.mjs'

const require = createRequire(import.meta.url);
const LOGGER = require('logger').get('TEST');
const COVERAGE_ENABLED = (typeof process.env['COVERAGE_CHECK_DISABLED'] == "undefined");

function fileExists(input) {
  if (typeof input != "string") { return false; }
  return fs.existsSync(input);
}

function locateShellLib(relPath) {
  let candidates = [
    `${ROOT_PATH}/sources/fs-root/${relPath}`,
    `${ROOT_PATH}/sources/fs-root/opt/batocera-emulationstation/lib/${relPath}`,
    `${ROOT_PATH}/sources/fs-root/opt/emulatorlauncher/lib/${relPath}`
  ]
  for (let cand of candidates) {
    if (fileExists(cand)) { return cand; }
  }
  return relPath;
}

/** Recursively splits an array of strings to prefix every line with its number, starting from 1. */
function lineNumbers(arr, lineNum = { current: 1 }) {
  if (!Array.isArray(arr)) { return lineNumbers([arr], lineNum); }
  return arr.map(line => {
    if (line.includes('\n')) { return lineNumbers(line.split('\n'), lineNum).join('\n') }
    return `[${String(lineNum.current++).padStart(2, ' ')}] ${line}`
  })
}

function failExecute(stderr, isAssertionFailure) {
  if (Array.isArray(stderr)) { stderr = stderr.join('\n'); }
  throw { stderr: stderr, isAssert: isAssertionFailure }
}

const SHELLTEST_COREFILE = `${ROOT_PATH}/test/js/utils/shelltest-core.sh`;
const TEST_TAG = '::TEST-';
/** Contains variables which must **not** be changed by a test. */
const SH_API = {
  BASH_ENV: SHELLTEST_COREFILE,
  TEST_TAG: TEST_TAG,
  ROOT_DIR: ROOT_PATH,
  TEST_FUNCTION: TEST_TAG + 'FUNCTION::',
  // assertion failures
  FAILURE_MARKER_START: TEST_TAG + 'FAILURE-START::',
  FAILURE_MARKER_END: TEST_TAG + 'FAILURE-END::',
  // unexpected exits
  ERROR_MARKER_START: TEST_TAG + 'ERROR-START::',
  ERROR_MARKER_END: TEST_TAG + 'ERROR-END::',
  /** used to distinguish 'regular' exits from exits out of failed asserts/verifications */
  ASSERTION_ERROR_CODE: 110,
  /** For 'unexpected' none-assert errors caught be the test */
  ERR_EXIT_CODE: 200
}

/** 
 * These variables are understood by `shelltest-core.sh`, but not required.  
 * Placed here for quick reference and usage as constants when building env, e.g. from `ShellBehaviourConfig`.
 */
const SH_API_OPT = {
  LOCK_ERROR_TRAP: 'LOCK_ERROR_TRAP',
  ENABLE_COVERAGE: 'ENABLE_COVERAGE',
  /** For coverage: Converts absolute paths to relative, using this as a the base. */
  COVERAGE_ROOT: 'COVERAGE_ROOT',
}

function toEchoInput(obj) { return String(obj).replaceAll('\n', '\\n'); }

/**
 * Represents the options that can be passed to [verifyFunction](#class_shelltestrunner_verifyFunction) 
 * as second argument to control the behaviour of mocked functions. 
 */
class MockOptions {
  /** Stdout of the function. Can be used together with `err`. Printed first. */
  get out() { return ""; }
  /** Stderr of the function. Can be used together with `out`. Printed second.  */
  get err() { return ""; }
  /** Arbitrary shell code to be executed. Last step before return. */
  get exec() { return ""; }
  /** Return value/exit code of the function. Can contained shell code strings. */
  get code() { return 0; }
}

/**
 * This is a helper class for testing shell library files and executables in general.  
 * **Usage:** 
 * 1. Easy way: Define a test class that extends from `GenericShellTestRunner`
 * 2. Hard way: Use test hooks like `beforeEach` to manage an instance of GenericShellTestRunner, or build one per test.
 * <p>
 * **Test flow**:
 * 1. Get an instance of `GenericShellTestRunner` in any way
 * 2. use `testFile(path, testMode)` to configure how the shell file is to be included
 * 3. Use the various configuration, '...Action()' and 'verify...()' methods to set up actions to take
 * 4. When `execute()` is called, a wrapper script for the file under test will be generated dynamically  
 *    from the input provided beforehand.  
 *    This script will be piped to a bash subprocess without generating an intermediate file.
 * 5. Verifications defined beforehand will be done by a mixture of bash test statements and output parsing in js.  
 *    `execute()` will throw an exception in case of test failures or unexpected errors.
 * 6. Due to the way the wrapper script is piped through stdin, providing mocked 'user input' is currently not supported on a global level.  
 *    When 'input' needs to be simulated, add a pipe or redirection to test commands directly.
 * </p>
 */
export class GenericShellTestRunner {
  static Mode = Object.freeze({
    EXEC: "EXEC", SOURCE: "SOURCE"
  });

  #executeCalled = false;
  #generatedTestFile = false;
  #tmpDir = false;
  #behaviourConfig = new ShellTestBehaviour(this);

  functionVerifiers = {}
  verifiers = []
  fileUnderTest = null;

  testEnv = { LC_ALL: 'C' }
  testArgs = [];
  preActionLines = [];
  postActionLines = [];

  constructor(testName) { this.name = testName; }

  get behaviour() { return this.#behaviourConfig; }
  /** Calculates the effective envs to pass to the test shell. */
  get effectiveEnv() {
    let coverage_addition = {}
    if (typeof this.testEnv[SH_API_OPT.ENABLE_COVERAGE] == "undefined") {
      this.testEnv[SH_API_OPT.ENABLE_COVERAGE] = COVERAGE_ENABLED;
    }
    if (this.testEnv.DEBUG_MODE === true) { delete this.testEnv[SH_API_OPT.ENABLE_COVERAGE]; }
    if (this.testEnv[SH_API_OPT.ENABLE_COVERAGE] == true) {
      coverage_addition = { COVERAGE_RECORD_FD: 3, [SH_API_OPT.COVERAGE_ROOT]: process.env.SRC_DIR };
    }
    return Object.assign({}, this.testEnv, SH_API, coverage_addition);
  }
  get wasExecuted() { return this.#executeCalled; }

  beforeEach() {}
  afterEach(ctx) {
    try {
      if (!this.#executeCalled) {
        ctx.diagnostic("ShellTestRunner.execute() was not called - no test was run");
        assert.fail("ShellTestRunner.execute() was not called - no test was run");
      }
    } finally {
      if (this.success && this.#tmpDir && fileExists(this.TMP_DIR)) { fs.rmSync(this.TMP_DIR, { recursive: true, force: true }) }
      if (fileExists(this.#generatedTestFile)) { fs.rmSync(this.#generatedTestFile) }
      this.#generatedTestFile = '';
    }
  }

  testFile(target, mode = ShellTestRunner.Mode.SOURCE) {
    this.fileUnderTest = locateShellLib(target);
    this.testMode = mode;
  }

  environment(envObj = {}) { return Object.assign(this.testEnv, envObj), this; }
  arguments(...args) { return this.testArgs = args, this; }

  /** The given lines will be run after `testFile` was invoked. Appends to `this.postActions` in given order. */
  preActions(...scriptSourceLines) { return this.preActionLines.push(...scriptSourceLines), this; }
  /** The given lines will be run after `testFile` was invoked. Appends to `this.postActions` in given order. */
  postActions(...scriptSourceLines) { return this.postActionLines.push(...scriptSourceLines), this; }

  /** Add given verification commands to the list of verifiers. Handles `...string` OR one single string[]. */
  verify(...assertStrings) {
    if (assertStrings.length == 1 && Array.isArray(assertStrings[0])) { assertStrings = assertStrings[0]; }
    this.verifiers.push(...assertStrings);
  }

  /** add a special post action */
  #assertVarPattern(name, value, namePrefix = '') {
    let realValueResolver = Number.isInteger(parseInt(name)) ? `$\{${name}\}` : `$${name}`;
    return `test:verifyVar "${namePrefix}\\$${name}" "${value}" "${realValueResolver}"`;
  }
  verifyVariable(name, value) {
    if (Array.isArray(value)) {
      this.verify(value.map((val, idx) => this.#assertVarPattern(`{${name}[${idx}]}`, val)));
    } else if (typeof value == "object") {
      this.verify(Object.entries(value).map(([key, val]) => this.#assertVarPattern(`{${name}['${key}']}`, val)));
    } else {
      this.verify(this.#assertVarPattern(name, value))
    }
  }
  verifyVariables(varSet) {
    Object.entries(varSet).forEach(([key, value]) => this.verifyVariable(key, value));
  }
  /** Only checks if the script exports variables with the given names */
  verifyExports(...varNames) {
    varNames.forEach(name => this.verify(`test:verifyExport "${name}"`));
  }

  /** 
   * Verify that the given function was called and with at least the arguments supplied. Does not work in all situations.  
   * 1. WORKS: testScript does not declare the function itself (directly or by sourcing)
   * 2. WORKS: testScript declares itself, but test code/function has to be triggered after sourcing,
   *    e.g. when testScript itself is only a library of functions. In that case, the functionVerifier (=redeclaration of function)
   *    can be put into postActions, before the test call is added.
   * 3. WORKS NOT: when testScript and testCode themselves define and use the function immediately
   *    without any way to insert/overwrite the function with a test stub again.
   * 4. WORKS: Situation 3, BUT the script supports modularity by using `_hasFunc` before declaring a function
   * 5. bash ignores exit codes of sub-shells if not coded to catch and react on them
   * 6. Can not differentiate multiple invocations (yet)
   *
   * Argument verification does not enforce the function to receive the exact number of arguments, it can also receive more. 
   * Through this, it's also possible to use `verifyFunction` to define simple mocks and stubs.
   *
   * @param {string} name - function name
   * @param {MockOptions} [mock] - specify behavior of stubbed function, according to the options
   * @param {...string} [params] - to additionally verify values given as "$n", starting from 1.
   */
  verifyFunction(name, mock = {}, ...params) {
    if (typeof mock != "object") {
      params.unshift(mock);
      mock = {};
    }
    let varIdx = 1;
    let checks = params.map(p => '  ' + this.#assertVarPattern(varIdx++, p, `${name}() `));
    this.functionVerifiers[name] = new MockedShellFunction(name, mock, checks);
  }

  /**
   * This allows to verify that a certain function was NOT called at all.  
   * It works by stubbing the function with a code block that will error and exit.  
   * Can't be used together with [verifyFunction](#verifyfunction) for the same function, at least not
   * when `declareBefore=true`
   * 
   * The second argument controls whether the stub should be defined before (default=true) or 
   * after sourcing the actual file under test. The rules and reasons for this are similar to `verifyFunction`.
   * 
   * When `declareBefore=false`, stub is placed in `postActions`, so it would be possible to interleave with test actions. 
   */
  disallowFunction(name, declareBefore = true) {
    let forbidden = `test:disallowCommand '${name}'`;
    if (declareBefore) this.preActions(forbidden);
    else this.postActions(forbidden);
  }

  /**
   * Verify the exit code of a given command in a way that is compatible to the test script's default option 'set -e'.  
   * The given command is called and, depending on its code, a variable is assigned with either true or false.
   * The second step is a simple verification of that variable at the end.
   *
   * @param {string} command - statement whose exit code shall be captured and verified
   * @param {boolean} [expected=true] - expectation of success or failure
   */
  verifyExitCode(command, expected = true) {
    command = command.replaceAll(/(?<!')'(?!')/g, "'\\''");
    this.verify(`test:verifyExitCode '${command}' ${expected}`);
  }

  execute(logScriptOnFailure = false) {
    this.#executeCalled = true;

    let source = [
      '\n# preparation actions',
      ...this.preActionLines
    ];

    source.push(...Object.values(this.functionVerifiers));

    // build line that calls the actual file under test
    let testFileLine = this.fileUnderTest;
    if (this.testMode == ShellTestRunner.Mode.SOURCE) { testFileLine = 'builtin source ' + testFileLine }
    if (this.testArgs.length > 0) { testFileLine += ' \\\n\t' + this.testArgs.map(s => `"${s}"`).join(' ') }
    source.push('\n# execute file/command under test')
    source.push(testFileLine);

    source.push('\n# post actions and verifications');
    source.push(...this.postActionLines);

    source.push(...this.verifiers);

    let output;
    try {
      this.result = spawnSync("bash", {
        env: this.effectiveEnv,
        encoding: 'utf8',
        input: source.join('\n'),
        stdio: ['pipe', 'pipe', 'pipe', 'pipe']
      });

      output = new ShellOutput(this);
      output.scanForExceptionBlocks();

      let testStubCalls = output.extractTestFunctionCalls();
      Object.values(this.functionVerifiers).forEach(stub => {
        if (!testStubCalls.includes(stub.verifyTag)) {
          failExecute(`Missing function call: [${stub.name}]`, true);
        }
      });
      this.success = true;
      CoverageRecorder.parse(this.result.output[3]);
    } catch (e) {
      if (logScriptOnFailure || !e.isAssert) {
        LOGGER.error(`*** FAIL: ${this.name} - Script was:\n` + lineNumbers(source.join('\n')));
        //LOGGER.error(`*** HAPPENS-BEFORE:[\n${this.result.output[3]}\n]`);
      }
      let codeFailure = !e.isAssert ? `Script had error code ${this.result.status}!\nOutput:\n` : '';
      assert.fail(codeFailure + (e.stderr || 'Failed with no output!') + `\nTest temp dir: ${this.TMP_DIR}`);
    } finally {
      let testLog = [];
      if (this.result.stderr) {
        testLog.push('SH_DEBUG', this.result.stderr, 'END_DEBUG');
        this.result.fullErr = this.result.stderr;
        // Filter test control output from real script stderr to make assertion over output easier
        // output done with log functions will appear twice
        this.result.stderr = output.getRealErrorOutput().join('\n');
      }
      if (this.result.stdout) {
        testLog.push('SH_OUT', this.result.stdout, 'END_OUT')
      }
      LOGGER.info(testLog.join('\n'))
    }

  }

  /**
   * Get or create a temporary directory for the currently running test. As it also creates a directory on first call,
   * it is not suitable on its own to be used for existence checks.  
   * Use `this.#tmpDir` for this first, which will be `false` when `TMP_DIR` was not called at all.  
   * This will prevent an initial creation where it is not desired.
   * @returns {string}
   */
  get TMP_DIR() {
    if (!this.#tmpDir) {
      this.#tmpDir = `${TMP_DIR}/ShellTestRunner/` + randomUUID();
      fs.mkdirSync(this.#tmpDir, { recursive: true });
    }
    return this.#tmpDir;
  }

  get #testFileName() { return this.#generatedTestFile ||= `${this.TMP_DIR}/${this.name}_test.sh`; }
}

export class ShellTestRunner extends GenericShellTestRunner {
  imports = new ShellImports();

  constructor(name) {
    super(name);
    this.environment({
      SH_LIB_DIR: `${ROOT_PATH}/sources/fs-root/opt/batocera-emulationstation/lib`,
      core__callstackRelRoot: globalThis.ROOT_PATH,
      tty_OUTSTREAM: 2
    });
  }

  execute(...args) {
    this.preActionLines.unshift(
      `# imports prepared by ShellTestRunner: "${this.name}"`,
      this.imports.toShellCode(),
      ""
    );
    super.execute(...args);
  }
}

/** 
 * Utility to analyse the test output of `ShellTestRunner.execute()`.  
 * Should only be used during `execute()` after `ShellTestRunner.result` has been set.
 */
class ShellOutput {
  constructor(test) {
    this.test = test;
    this.result = test.result;
    this.resultLines = this.result.stderr.split('\n');
  }

  /** 
   * Searches stderr of result for special marker strings. When found, a matching error is thrown.  
   * Errors NOT coming from asserts are controlled by `ShellTestBehaviour.ignoreErrorCode`.
   * 
   * @throws `{stderr:string, isAssert:boolean}`
   */
  scanForExceptionBlocks() {
    // 'unplanned' exits take priority over asserts
    if (this.test.shouldThrowForError(this.result)) {
      this.#throwOnTaggedBlock(this.resultLines, "ERROR", false, true);
      // No error-tagged block means some code path that either suppressed output or unset the test framework
      // throw regardless, the output will just be raw and not filtered
      failExecute(this.result.stderr.trim(), false);
    }
    this.#throwOnTaggedBlock(this.resultLines, "FAILURE");
  }

  extractTestFunctionCalls() {
    return this.resultLines.filter(_ => _.startsWith(`${SH_API.TEST_FUNCTION}`))
  }

  /** Go over stderr and return all lines NOT enclosed in any `SH_API.TEST_TAG...` markers*/
  getRealErrorOutput() {
    let testBlockNesting = 0;
    let anyStartTag = new RegExp(`^${TEST_TAG}.*-START::`);
    let anyEndTag = new RegExp(`^${TEST_TAG}.*-END::`);
    return this.resultLines.filter(line => {
      let l = line.trim();
      if (anyStartTag.test(l)) { testBlockNesting++; }
      else if (anyEndTag.test(l)) { testBlockNesting--; }

      return !l.startsWith(TEST_TAG) && Math.max(0, testBlockNesting) == 0;
    });
  }

  #throwOnTaggedBlock(linesArray, tagType, isAssert = true, includeHeader = false) {
    let startTag = SH_API[`${tagType}_MARKER_START`];
    let endTag = SH_API[`${tagType}_MARKER_END`];
    let failIndex = linesArray.indexOf(startTag);
    let end = linesArray.indexOf(endTag, failIndex + 1);
    if (failIndex >= 0 && end > failIndex) {
      let resultLines = linesArray.slice(failIndex + 1, end);
      if (includeHeader && failIndex > 0) { resultLines.unshift(linesArray[failIndex - 1]) }
      failExecute(resultLines, isAssert);
    }
  }
}

class ShellTestBehaviour {
  #ignoreExitCode = false
  constructor(shellTest) {
    this.test = shellTest;
    // install a function bound to 'this' in ShellTest which depends on a private here
    // Benefit: The function is not visible in the behaviour class and doesn't clutter the API.
    Object.defineProperty(shellTest, 'shouldThrowForError', { value: this.#shouldThrowForError.bind(this) });
  }

  /** Enables/disables extended debug output in bash. Must be set before `execute`.*/
  setDebug(enable = true) { this.test.environment({ DEBUG_MODE: enable }); }

  /** When enabled, the test won't throw an error for shell processes returning **unexpected** exit codes. */
  ignoreExitCode(ignore = true) { this.#ignoreExitCode = ignore; }

  /**
   * Allow scripts to override the ERR trap installed by the test framework.  
   * When not allowed, scripts/tests trying to do so will fail.
   */
  allowErrTrapOverride(isAllowed = true) {
    this.test.environment({ [SH_API_OPT.LOCK_ERROR_TRAP]: isAllowed ? '' : true });
  }

  #shouldThrowForError(spawnResult) {
    if (this.#ignoreExitCode) { return false; }
    return spawnResult.status > 0 && spawnResult.status != SH_API.ASSERTION_ERROR_CODE;
  }
}

/** 
 * Handles 'imports' done in shell scripts based on `core.shl:import` and `source`.  
 * It also attempts to provide a sensible default for small shell tests of files which are expected
 * to be sourced from larger contexts while expecting a minimal environment.  
 * This mostly means that a lot of the shell libraries  expect 'logging.shl' just to be there,
 * without the respective file sourcing it on its own. Unless disabled, `ShellImports` automatically includes logging.shl.
 */
class ShellImports {
  // required when imports are pre-defined 
  static DECL_REGISTRY_DICT = '[ -v __BTCSH_IMPORTED_FILES ] || declare -gA __BTCSH_IMPORTED_FILES';
  static LOAD_CORE = 'source "${SH_LIB_DIR}/core.shl"';
  static LOAD_LOG_NOCORE = 'source "${SH_LIB_DIR}/logging.shl"';
  static LOAD_LOG_WITHCORE = 'import logging.shl';

  /** Provides an alias-based override of 'source' which will be removed when 'core.shl' is loaded. */
  static BLOCKABLE_SOURCE_CMD = `
shopt -s expand_aliases
alias 'source=__shell_import_source source'
alias 'import=__shell_import_source import'
function __shell_import_find {
  local fileLocations=(
    "$1"
    "$1.shl"
    "\${SH_LIB_DIR}/$1"
    "\${SH_LIB_DIR}/$1.shl"
    "\${FS_ROOT}/$1"
    "\${FS_ROOT}/$1.shl"
  )
  local candidateLocation="" absFile=""
  for candidateLocation in "\${fileLocations[@]}"; do
    candidateLocation="$(realpath "\${candidateLocation}" 2>/dev/null || true)"
    [ -f "\${candidateLocation}" ] || continue
    absFile="\${candidateLocation}"
  done
  builtin echo "\${absFile:-$1}"
}
function __shell_import_source {
  local origin="$1" && shift
  local sourceCommand=(builtin source)
  if [ "\${origin}" = "import" ] && declare -Fp import &>/dev/null; then
    # there is an alias AND a function named import - core was loaded so unset/remove the alias
    test:diag "[core.shl:import] is available - remove alias"
    unalias import
    sourceCommand=(import)
  fi
  local fullPath=""
  if [[ $1 =~ ^/dev/fd/ ]]; then
    exec {test__wrappedSourceFd}<"$1"
    fullPath="/dev/fd/\${test__wrappedSourceFd}"  # temp fd has to be remapped as it is consumed by the current function
  else
    fullPath="$(__shell_import_find "$1")"
  fi
  test:diag "[test:$origin@$(basename "\${BASH_SOURCE[1]}"):\${BASH_LINENO[0]}] Try to import $1, found at: $fullPath"
  shift
  if [ -n "\${__BTCSH_IMPORTED_FILES["$fullPath"]}" ]; then
    test:diag "Skip sourcing of [$fullPath] because it was sourced already."
    return 0;
  fi
  "\${sourceCommand[@]}" "$fullPath" "$@"
  __BTCSH_IMPORTED_FILES["$fullPath"]=true
}`;

  #importConfig = {};

  #importDefaults = true;

  get entries() { return Object.entries(this.#importConfig); }

  /** Can be used to toggle the default imports on/off. For convenience, disabling works by not giving an argument. */
  disableDefaults(disableDefaultImports = true) { this.#importDefaults = !disableDefaultImports; }

  /** Import at the beginning. Useful for scripts expecting to be called from more complex requirements. */
  add(...shlFiles) { shlFiles.map(locateShellLib).forEach(absPath => this.#importConfig[absPath] = true); }

  /** Prevent given files from being loaded. */
  block(...shlFiles) { shlFiles.map(locateShellLib).forEach(absPath => this.#importConfig[absPath] = false); }

  /** Remove given files from import config, regardless of whether they were set via 'add' or 'block' */
  unset(...shlFiles) { shlFiles.map(locateShellLib).forEach(absPath => delete this.#importConfig[absPath]); }

  /** Will be called during `ShellTestRunner.execute`. */
  toShellCode() {
    let testImports = this.entries.filter(e => e[1] == true);
    let hasImports = testImports.length > 0;
    let defaultImports = [];
    if (this.#importDefaults) {
      if (hasImports) { testImports.unshift(ShellImports.LOAD_LOG_WITHCORE) }
      else { defaultImports = [ShellImports.LOAD_LOG_NOCORE]; }
    }
    return [
      hasImports ? ShellImports.LOAD_CORE : ShellImports.DECL_REGISTRY_DICT,
      ShellImports.BLOCKABLE_SOURCE_CMD,
      ...(this.entries.filter(e => e[1] == false).map(e => `__BTCSH_IMPORTED_FILES["${e[0]}"]=true`)),
      ...defaultImports,
      ...(testImports.map(e => `import "${e[0]}"`)),
    ].join('\n');
  }

}

class MockedShellFunction {
  #code
  constructor(name, mock, stubActions) {
    this.name = name;
    this.verifyTag = `${SH_API.TEST_FUNCTION}${name}::`;
    let functionBody = [
      `function ${name} {`,
      `  builtin echo "${this.verifyTag}" >&2`,
      ...stubActions,
      `  ${mock.out ? `builtin echo -ne "${toEchoInput(mock.out)}"` : ''}`,
      `  ${mock.err ? `builtin echo -ne "${toEchoInput(mock.err)}" >&2` : ''}`,
      '  ' + (mock.exec || ''),
      `  return ${mock.code || 0}`,
      '}',
      `export -f ${name}`
    ];
    this.#code = functionBody.filter(l => l.trim().length > 0).join('\n');
  }

  toString() { return this.#code; }
}
