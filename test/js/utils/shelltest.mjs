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

const TEST_TAG = '::TEST-';
// assertion failures
const FAILURE_MARKER_START = TEST_TAG + 'FAILURE-START::';
const FAILURE_MARKER_END = TEST_TAG + 'FAILURE-END::';
// unexpected exits
const ERROR_MARKER_START = TEST_TAG + 'ERROR-START::';
const ERROR_MARKER_END = TEST_TAG + 'ERROR-END::';

// used to distinguish 'regular' exits from exits out of failed asserts/verifications
const ASSERTION_ERROR_CODE = 110;

// when the shell exits due to 'set -e' (unexpected error), print the stack trace
const SHELL_EXIT_HANDLER = `
function _callstack {
  [ -z "$1" ] || builtin printf '%s\\n' "$1"

  local idx="\${2:-0}"
  while [ -n "\${BASH_LINENO[$idx]}" ]; do 
    local _line="\${BASH_LINENO[$idx]}"
    local _file="\${BASH_SOURCE[$idx+1]:-stdin}"
    local _func="\${FUNCNAME[$idx+1]:-main}"
    builtin printf '\\tat %s (%s:%d)\\n' "$_func" "$_file" "$_line"
    # use pre-increment so that let won't return an error code of '0++'
    let ++idx 
  done
}
export -f _callstack

set -E
trap 'CODE="$?"; [ "$CODE" = 0 ] || { 
builtin echo "${ERROR_MARKER_START}" >&2
_callstack "CMD: $BASH_COMMAND" >&2
builtin echo "${ERROR_MARKER_END}" >&2
builtin exit $CODE
}' ERR`;

// Used when building test script.
// Replicate logging.lib so that all log output can be captured in tests.
const SHELL_LOGGING = `
LOGFILE=/dev/null
function _logOnly { 
  local RET="$?"
  printf '%s\n' "$(LC_ALL=C lc "$@")" >&2 \
    || return "$?"
  return "$RET"
}
function _outOnly { _logOnly "$@"; }
function _logAndOut { _logOnly "$@"; }
function _logAndOutWhenDebug { 
  RET="$?"
  [ -z "$PRINT_DEBUG" ] && return "$RET"
  _logOnly "$@"
  return "$RET" 
}
function _pipeDebugLog { RET="$?"; command cat - >&2 && return "$RET"; }
export -f _logOnly _logAndOut _logAndOutWhenDebug _pipeDebugLog
`.trim();

// Used when building test script.
// Contains core assertion utility. 
const TEST_HELPERS = `
# some helper functions
# copied from user-paths.lib
function _hasFunc {
  local t="$(type -t "$1" 2>/dev/null)"
  [ "$t" = "function" ]
}
function lc {
  if [ -n "$NO_LC" ]; 
    then local msg="$1"
    else local msg=$(gettext "$1")
  fi
  shift

  let _positionalString=0 || true
  while [ -n "$1" ]; do
    if [ -v "$1" ]; then
      msg="\${msg//%%\${1}%%/"\${!1}"}"
    else
      let ++_positionalString
      msg="\${msg//%%\${_positionalString}%%/"$1"}"
    fi
    shift
  done
  builtin echo "$msg"
}
export -f lc
# used for test value verifications
function verifyVar {
  local matcher="^\${2}$"
  [[ $3 =~ $matcher ]] || [ "$3" = "$2" ] || {
    builtin echo "${FAILURE_MARKER_START}" >&2
    builtin echo "expected: [$1=\\"$2\\"]" >&2
    builtin echo " but was: [$1=\\"$3\\"]" >&2
    _callstack >&2
    builtin echo "${FAILURE_MARKER_END}" >&2
    builtin exit ${ASSERTION_ERROR_CODE}
  }
  return 0
}`.trim();

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
  get out() { return "" }
  /** Stderr of the function. Can be used together with `out`. Printed second.  */
  get err() { return "" }
  /** Arbitrary shell code to be executed. Last step before return. */
  get exec() { return "" }
  /** Return value/exit code of the function. Can contained shell code strings. */
  get code() { return 0 }
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
 */
export class ShellTestRunner {
  static Mode = Object.freeze({
    EXEC: "EXEC", SOURCE: "SOURCE"
  });

  #executeCalled = false;
  #testFileWrapper = false;
  #tmpDir = false;
  //used to generate default var names in `verifyExitCode`
  #exitCodeVars = 0;
  functionVerifiers = {}
  verifiers = []
  fileUnderTest = null;
  throwOnError = true;
  debugMode = false;
  testEnv = {}
  testArgs = [];
  preActions = [
    'set -e',
    SHELL_LOGGING
  ];
  postActionLines = [];
  constructor(testName) { this.name = testName }

  beforeEach() { }

  afterEach(ctx) {
    try {
      if (!this.#executeCalled) {
        ctx.diagnostic("ShellTestRunner.execute() was not called - no test was run");
        assert.fail("ShellTestRunner.execute() was not called - no test was run");
      }
    } finally {
      if (this.success && fs.existsSync(this.TMP_DIR)) { fs.rmSync(this.TMP_DIR, { recursive: true, force: true }) }
      if (fs.existsSync(this.#testFileWrapper)) { fs.rmSync(this.#testFileWrapper) }
      this.#testFileWrapper = '';
    }
  }

  testFile(target, mode = ShellTestRunner.Mode.SOURCE) {
    let madeAbs = `${ROOT_PATH}/sources/fs-root/${target}`;
    if (!fs.existsSync(target) && fs.existsSync(madeAbs)) {
      target = madeAbs;
    }
    this.fileUnderTest = target;
    this.testMode = mode;
  }

  environment(envObj = {}) { return this.testEnv = Object.assign(this.testEnv, envObj), this; }
  arguments(...args) { return this.testArgs = args, this; }

  /** 
   * The given lines will be performed after testFile was invoked.
   * Will always append to the postActions in order of invocation.
   */
  postActions(...scriptSourceLines) { return this.postActionLines.push(...scriptSourceLines), this; }

  verify(...assertStrings) { this.verifiers.push(...assertStrings) }

  /** add a special post action */
  #assertVarPattern(name, value, namePrefix = '') {
    let realValueResolver = Number.isInteger(parseInt(name)) ? `$\{${name}\}` : `$${name}`;
    return `verifyVar "${namePrefix}\\$${name}" "${value}" "${realValueResolver}"`;
  }
  verifyVariable(name, value) {
    if (Array.isArray(value)) {
      this.verify(
        ...(value.map((val, idx) => this.#assertVarPattern(`{${name}[${idx}]}`, val)))
      )
    } else if (typeof value == "object") {
      this.verify(
        ...(Object.entries(value).map(([key, val]) => this.#assertVarPattern(`{${name}['${key}']}`, val)))
      );
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
      ...varNames.map(name => `[ -n "$(export -p | grep -oE -- '-x ${name}=')" ] || { echo '${name} must be exported!' >&2 && exit 1; } `)
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
      params.unshift(mock)
      mock = {}
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
   * Can't be used together with [verifyFunction](#verifyfunction) for the same function.
   * 
   * The second argument controls whether the stub should be defined before (default=true) or 
   * after sourcing the actual file under test. The rules and reasons for this are similar to `verifyFunction`. 
   */
  disallowFunction(name, declareBefore = true) {
    let forbidden = `
${name} () {
  builtin echo "${FAILURE_MARKER_START}" >&2
  _callstack "forbidden function call: ${name}" >&2
  builtin echo "${FAILURE_MARKER_END}" >&2
  exit ${ASSERTION_ERROR_CODE}
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
    this.postActions(`if ${command}; then ${varName}=true; else ${varName}=false; fi`);
    this.verifyVariable(varName, expected);
  }

  execute(logScriptOnFailure = false) {
    this.#executeCalled = true;
    let targetFile = this.#testFileName
    fs.mkdirSync(dirname(targetFile), { recursive: true });
    let source = [SHELL_EXIT_HANDLER];

    source.push('\n# preparation actions');
    source.push(...this.preActions)
    source.push(TEST_HELPERS);

    if (this.debugMode) {
      source.push(
        'set -o functrace',
        `trap 'echo "[$(basename $\{BASH_SOURCE[0]\} 2>/dev/null || echo ""):$LINENO]> ($?) $BASH_COMMAND" >&2' DEBUG`
      )
    }
    source.push(...Object.values(this.functionVerifiers))

    // build line that calls the actual file under test
    let testFileLine = this.fileUnderTest;
    if (this.testMode == ShellTestRunner.Mode.SOURCE) { testFileLine = 'source ' + testFileLine }
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

  get TMP_DIR() {
    if (!this.#tmpDir) {
      this.#tmpDir = `${this.#testFileName.replace(/.sh$/, '')}`;
      fs.mkdirSync(this.#tmpDir, { recursive: true });
    }
    return this.#tmpDir;
  }

  get #testFileName() {
    if (!this.#testFileWrapper) {
      this.#testFileWrapper = `${TMP_DIR}/ShellTestRunner/` + randomUUID() + '.sh';
    }
    return this.#testFileWrapper;
  }
}
