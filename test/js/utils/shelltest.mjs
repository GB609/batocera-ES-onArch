// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname } from 'path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const LOGGER = require('logger').get('TEST');

function fileExists(input) {
  if (typeof input != "string") { return false; }
  return fs.existsSync(input);
}

function locateShellLib(relPath) {
  let madeAbs = `${ROOT_PATH}/sources/fs-root/${relPath}`;
  if (!fileExists(relPath) && fileExists(madeAbs)) {
    return madeAbs;
  }
  return relPath;
}

const TEST_TAG = '::TEST-';
// assertion failures
const FAILURE_MARKER_START = TEST_TAG + 'FAILURE-START::';
const FAILURE_MARKER_END = TEST_TAG + 'FAILURE-END::';
// unexpected exits
const ERROR_MARKER_START = TEST_TAG + 'ERROR-START::';
const ERROR_MARKER_END = TEST_TAG + 'ERROR-END::';

// used to distinguish 'regular' exits from exits out of failed asserts/verifications
const ASSERTION_ERROR_CODE = 110;

/**
 * Various constants holding shell code to be injected/used when building a test file.
 */
const SH_SNIPPETS = {
  /** Load and configure `core.shl`. */
  CORE_LIB: `
core__callstackHandler=encloseInErrorMarker

function encloseInErrorMarker {
  builtin echo "${ERROR_MARKER_START}" >&2
  command cat - >&2
  builtin echo "${ERROR_MARKER_END}" >&2
}
builtin source "${SRC_PATH}/lib/core.shl"`,

  /** Install an error trap to 'throw' on test errors. Requires `core.shl`. */
  EXIT_HANDLER: `
set -E
declare -ga EXC_LINES
trap 'CODE="$?"; CURLINE="$LINENO"; [ "$CODE" = ${ASSERTION_ERROR_CODE} ] || {
  errline="\${BASH_LINENO[0]}"
  cmd="\${BASH_COMMAND@Q}"
  curDepth="\${#FUNCNAME[@]}"
  if [ "\${LAST_DEPTH}" -lt "\${curDepth}" ]; then
    . <(
      unset EXC_LINES
      declare -ga EXC_LINES
    )
  fi
  if [ "\${EXC_LINES[$CURLINE]@Q}" != "\${cmd}" ]; then
    core:callstack "CMD: \${cmd}"
  fi
  . <( 
    echo "EXC_LINES[$errline]=\${cmd}"
    echo "LAST_DEPTH=$curDepth"
  )
  [ -v NOEXIT ] || builtin exit $CODE
}' ERR`,

  /** pre-import `logging.shl` and configure ouput to go to stderr only */
  LOG: `
SH_LIB_DIR="${SRC_PATH}/lib" import --function lc generic-utils.shl
export utils_LC_PRINTER='builtin echo'
SH_LIB_DIR="${SRC_PATH}/lib" import logging.shl /dev/null`,

  /** Used when building test script. Contains core assertion utility. */
  TEST_HELPERS: `
# some helper functions
# copied from user-paths.shl
function _hasFunc {
  local t="$(type -t "$1" 2>/dev/null)"
  [ "$t" = "function" ]
}
# used for test value verifications
function verifyVar {
  local matcher="^\${2}$"
  [[ $3 =~ $matcher ]] || [ "$3" = "$2" ] || {
    builtin echo "${FAILURE_MARKER_START}"
    builtin echo "expected: [$1=\\"$2\\"]"
    builtin echo " but was: [$1=\\"$3\\"]"
    core__callstackHandler="" core:callstack
    builtin echo "${FAILURE_MARKER_END}"
    builtin exit ${ASSERTION_ERROR_CODE}
  } >&2
  return 0
}`,

  /** Additional code for detailed debug logs. */
  DEBUG_MODE: `
set -o functrace
trap 'echo "[$(basename \${BASH_SOURCE[0]} 2>/dev/null || echo ""):$LINENO]> ($?) $BASH_COMMAND" >&2' DEBUG`
};
Object.freeze(SH_SNIPPETS);

function throwForBlock(output, startTag, endTag, isAssert = true, includeHeader = false) {
  let failIndex = output.indexOf(startTag);
  let end = output.indexOf(endTag, failIndex + 1);
  if (failIndex >= 0 && end > failIndex) {
    let resultLines = output.slice(failIndex + 1, end);
    if (includeHeader && failIndex > 0) { resultLines.unshift(output[failIndex - 1]) }
    throw { stderr: resultLines.join('\n'), isAssert: isAssert }
  }
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
 * Usage: 
 * 1. Easy way: Define a test class that extends from `ShellTestRunner`
 * 2. Hard way: Manually code usage of all hooks like `beforeEach` into any test flow instantiating ShellTestRunner.
 * <p>
 * **Test flow**:
 * 1. Get an instance of `ShellTestRunner` in any way
 * 2. use `testFile(path, testMode)` to configure how the shell file is to be included
 * 3. Use the various configuration, '...Action()' and 'verify...()' methods to set up actions to take
 * 4. When `execute()` is called, a wrapper script for the file under test will be generated dynamically  
 *    from the input provided beforehand.  
 *    This script will be piped to a bash subprocess without generating an intermediate file.
 * 5. Verifications defined beforehand will be done by a mixture of bash test statements and output parsing in js.  
 *    `execute()` will throw an exception in case of test failures or unexpected errors.
 * 6. Due to the way the wrapper script is piped through stdin, providing mocked 'user input' is currently not supported. 
 * </p>
 */
export class ShellTestRunner {
  static Mode = Object.freeze({
    EXEC: "EXEC", SOURCE: "SOURCE"
  });

  #executeCalled = false;
  #generatedTestFile = false;
  #tmpDir = false;
  //used to generate default var names in `verifyExitCode`
  #exitCodeVars = 0;

  imports = new ShellImports();

  functionVerifiers = {}
  verifiers = []
  fileUnderTest = null;
  throwOnError = true;
  debugMode = false;
  testEnv = {
    LC_ALL: 'C',
    SH_LIB_DIR: `${ROOT_PATH}/sources/fs-root/opt/batocera-emulationstation/lib`,
    core__callstackRelRoot: globalThis.ROOT_PATH
  }
  testArgs = [];
  preActions = [SH_SNIPPETS.LOG];
  postActionLines = [];
  constructor(testName) { this.name = testName }

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

  environment(envObj = {}) { return this.testEnv = Object.assign(this.testEnv, envObj), this; }
  arguments(...args) { return this.testArgs = args, this; }

  /** 
   * The given lines will be performed after testFile was invoked.
   * Will always append to the postActions in order of invocation.
   */
  postActions(...scriptSourceLines) { return this.postActionLines.push(...scriptSourceLines), this; }

  /** Add given verification commands to the list of verifiers. Handles `...string` OR one single string[]. */
  verify(...assertStrings) {
    if (assertStrings.length == 1 && Array.isArray(assertStrings[0])) { assertStrings = assertStrings[0]; }
    this.verifiers.push(...assertStrings);
  }

  /** add a special post action */
  #assertVarPattern(name, value, namePrefix = '') {
    let realValueResolver = Number.isInteger(parseInt(name)) ? `$\{${name}\}` : `$${name}`;
    return `verifyVar "${namePrefix}\\$${name}" "${value}" "${realValueResolver}"`;
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
    this.verify(
      varNames.map(name => `[ -n "$(export -p | grep -oE -- '-x ${name}=')" ] || { echo '${name} must be exported!' >&2 && exit 1; }`)
    )
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
    let functionBody = [
      `function ${name} {`,
      `  builtin echo "::TEST-FUNCTION::${name}::" >&2`,
      ...checks,
      `  ${mock.out ? `builtin echo -ne "${toEchoInput(mock.out)}"` : ''}`,
      `  ${mock.err ? `builtin echo -ne "${toEchoInput(mock.err)}" >&2` : ''}`,
      '  ' + (mock.exec || ''),
      `  return ${mock.code || 0}`,
      '}',
      `export -f ${name}`
    ];
    this.functionVerifiers[name] = functionBody.filter(l => l.trim().length > 0).join('\n');
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
    let forbidden = `
${name} () {
  builtin echo "${FAILURE_MARKER_START}" >&2
  core__callstackHandler="" core:callstack "forbidden function call: ${name}" >&2
  builtin echo "${FAILURE_MARKER_END}" >&2
  builtin exit ${ASSERTION_ERROR_CODE}
}`.trim();
    if (declareBefore) this.preActions.push(forbidden);
    else this.postActions(forbidden);
  }

  /**
   * Verify the exit code of a given command in a way that is compatible to the test script's default option 'set -e'.  
   * The given command is called and, depending on its code, a variable is assigned with either true or false.
   * The second step is a simple verification of that variable at the end.
   *
   * @param {string} command - statement whose exit code shall be captured and verified
   * @param {boolean} [expected=true] - expectation of success or failure
   * @param {string} [varName='EXIT_CODE_#'] - Variable name to use in assertion for clarity. Default uses prefix + counter.
   */
  verifyExitCode(command, expected = true, varName = `EXIT_CODE_${this.#exitCodeVars++}`) {
    let negValue = "false"
    if (Number.isInteger(expected) && expected > 0) { negValue = '$?'; }
    else if (expected === 0) { expected = true; }

    this.postActions(
      'NOEXIT=1',
      `if ${command}; then ${varName}=true; else ${varName}="${negValue}"; fi`,
      'unset NOEXIT'
    );
    this.verifyVariable(varName, expected);
  }

  execute(logScriptOnFailure = false) {
    this.#executeCalled = true;
    let source = [
      SH_SNIPPETS.EXIT_HANDLER,
      '\n# preparation actions',
      SH_SNIPPETS.CORE_LIB,
      this.imports.toShellCode(),
      ...this.preActions,
      SH_SNIPPETS.TEST_HELPERS
    ];

    if (this.debugMode) { source.push(SH_SNIPPETS.DEBUG_MODE); }
    source.push(...Object.values(this.functionVerifiers))

    // build line that calls the actual file under test
    let testFileLine = this.fileUnderTest;
    if (this.testMode == ShellTestRunner.Mode.SOURCE) { testFileLine = 'builtin source ' + testFileLine }
    if (this.testArgs.length > 0) { testFileLine += ' \\\n\t' + this.testArgs.map(s => `"${s}"`).join(' ') }
    source.push('\n# execute file/command under test')
    source.push(testFileLine);

    source.push('\n# post actions and verifications');
    source.push(...this.postActionLines);

    source.push(...this.verifiers);

    try {
      this.result = spawnSync("bash", {
        env: this.testEnv,
        encoding: 'utf8',
        input: source.join('\n')
      });
      let resultLines = this.result.stderr.trim().split('\n');
      // 'unplanned' exits take priority over asserts
      if (this.throwOnError
        && this.result.status > 0 && this.result.status != ASSERTION_ERROR_CODE) {
        throwForBlock(resultLines, ERROR_MARKER_START, ERROR_MARKER_END, false, true);
        throw { stderr: this.result.stderr.trim(), isAssert: false }
      }
      throwForBlock(resultLines, FAILURE_MARKER_START, FAILURE_MARKER_END);

      for (let name in this.functionVerifiers) {
        if (!resultLines.includes(`::TEST-FUNCTION::${name}::`)) {
          throw { stderr: `Missing function call: [${name}]`, isAssert: true }
        }
      }
      this.success = true;
    } catch (e) {
      if (logScriptOnFailure || !e.isAssert) {
        let lineNum = 1;
        function lineNumbers(arr) {
          return arr.map(line => {
            if (line.includes('\n')) { return lineNumbers(line.split('\n')).join('\n') }
            return `[${String(lineNum++).padStart(2, ' ')}] ${line}`
          })
        }
        LOGGER.error(`*** FAIL: ${this.name} - Script was:\n` + lineNumbers(source).join('\n'))
      }
      let codeFailure = !e.isAssert ? `Script had error code ${this.result.status}!\nOutput:\n` : '';
      assert.fail(codeFailure + (e.stderr || 'Failed with no output!') + `\nTest temp dir: ${this.TMP_DIR}`);
    } finally {
      let testLog = [];
      if (this.result.stderr) {
        testLog.push(
          'SH_DEBUG:',
          this.result.stderr,
          'END_DEBUG',
        );
        let inTestBlock = 0;
        this.result.fullErr = this.result.stderr;
        // filter test control output from real script stderr.
        // Makes assertions easier
        // output done with log functions will appear twice
        this.result.stderr = this.result.stderr.split('\n')
          .filter(line => {
            let l = line.trim();
            if (/^::TEST-.*-START::/.test(l)) { inTestBlock++; }
            else if (/^::TEST-.*-END::/.test(l)) { inTestBlock--; }

            return !l.startsWith(TEST_TAG) && Math.max(0, inTestBlock) == 0;
          })
          .join('\n');
      }
      if (this.result.stdout) {
        testLog.push(
          'SH_OUT',
          this.result.stdout,
          'END_OUT'
        )
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

/** Handles 'imports' done in shell scripts based on `core.shl:import` and `source`. */
class ShellImports {
  static BLOCKABLE_SOURCE_CMD = `
function . { source "$@"; }
function source {
  if [ "\${FUNCNAME[1]}" = import ]; then
    builtin source "$@"
  else
    import "$@";
  fi
}`;

  #importConfig = {};

  get entries() { return Object.entries(this.#importConfig); }

  /** Import at the beginning. Useful for scripts expecting to be called from more complex requirements. */
  add(...shlFiles) { shlFiles.map(locateShellLib).forEach(absPath => this.#importConfig[absPath] = true); }

  /** Prevent given files from being loaded. */
  block(...shlFiles) { shlFiles.map(locateShellLib).forEach(absPath => this.#importConfig[absPath] = false); }

  /** Will be called during `ShellTestRunner.execute`. */
  toShellCode() {
    return [
//      ShellImports.BLOCKABLE_SOURCE_CMD,
      ...(this.entries.filter(e => e[1] == false).map(e => `__BTCSH_IMPORTED_FILES["${e[0]}"]=true`)),
      ...(this.entries.filter(e => e[1] == true).map(e => `import "${e[0]}"`)),
    ].join('\n');
  }
}
