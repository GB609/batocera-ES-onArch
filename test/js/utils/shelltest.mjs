import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname } from 'path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const LOGGER = require('config.libs/logger').get('TEST');

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
 *    `execute()` will automatically assert.fail in case of errors.
 * 6. Due to the way the wrapper script is piped through stdin, providing mocked 'user input' is currently not supported. 
 */
export class ShellTestRunner {
  static Mode = Object.freeze({
    EXEC: "EXEC", SOURCE: "SOURCE"
  });

  #executeCalled = false;
  #testFileWrapper = '';
  //used to generate default var names in `verifyExitCode`
  #exitCodeVars = 0;
  functionVerifiers = {}
  verifiers = []
  fileUnderTest = null;
  testEnv = {}
  testArgs = [];
  preActions = [
    //replicate logging.lib so that all log output can be captured in tests
    'set -e',
    'function _logOnly { echo "$@" >&2; }',
    'function _logAndOut { echo "$@" >&2; }',
    'function _logAndOutWhenDebug { echo "$@" >&2; }',
    'function _pipeDebugLog { cat - >&2; }'
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
  #assertVarPattern(name, value, namePrefix = '') { return `verifyVar "${namePrefix}\\$${name}" "${value}" "$\{${name}\}"`; }
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
   * @param {object} [mock] - specify function stdout/stderr and exit code
   * @param {...string} [params] - to additionally verify values given as "$n", starting from 1.
   */
  verifyFunction(name, mock = {}, ...params) {
    if (typeof mock != "object") {
      params.unshift(mock)
      mock = {}
    }
    let varIdx = 1;
    let checks = params.map(p => '  ' + this.#assertVarPattern(varIdx++, p, `${name}() `))
    this.functionVerifiers[name] = `
function ${name} {
  echo "::TEST-FUNCTION::${name}::" >&2
${checks.join('\n')}${mock.out ?
        `\necho -ne "${String(mock.out).replaceAll('\n', '\\n')}"` : ''}${mock.err ?
          `\necho -ne ${String(mock.err).replaceAll('\n', '\\n')} >&2` : ''}
  return ${mock.code || 0}
}
export -f ${name}`;
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
    this.postActions(`${command} && ${varName}=true || ${varName}=false`);
    this.verifyVariable(varName, expected);
  }

  execute(logScriptOnFailure = false) {
    this.#executeCalled = true;
    let targetFile = this.#testFileName()
    fs.mkdirSync(dirname(targetFile), { recursive: true });
    let source = [];

    source.push(...this.preActions)
    source.push(
      `# some helper functions
# copied from common-paths.lib
function _hasFunc {
  local t="$(type -t "$1" 2>/dev/null)"
  [ "$t" = "function" ]
}
# used for test value verifications
function verifyVar {
  local matcher="^\${2}$"
  [[ $3 =~ $matcher ]] || [ "$3" = "$2" ] || {
    echo "::TEST-FAILURE::" >&2
    echo "expected: [$1=\\"$2\\"]" >&2
    echo " but was: [$1=\\"$3\\"]" >&2
    echo "::END-FAILURE::" >&2
    exit 1
  }
}`
    );
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
      //fs.writeFileSync(targetFile, source.join('\n') + '\n', { encoding: 'utf8' });
      this.result = spawnSync("bash", {
        //`${targetFile}`, {
        //shell: "/bin/bash",
        env: this.testEnv,
        encoding: 'utf8',
        input: source.join('\n')
      });
      let resultLines = this.result.stderr.trim().split('\n');
      let failIndex = resultLines.indexOf("::TEST-FAILURE::");
      if (failIndex >= 0) {
        let end = resultLines.indexOf('::END-FAILURE::', failIndex + 1)
        throw { stderr: resultLines.slice(failIndex + 1, end).join('\n'), isAssert: true }
      }
      for (let name in this.functionVerifiers) {
        if (!resultLines.includes(`::TEST-FUNCTION::${name}::`)) {
          throw { stderr: `Missing function call: [${name}]`, isAssert: true }
        }
      }
      if (this.result.status > 0) {
        throw { stderr: this.result.stderr.trim(), isAssert: false }
      }
    } catch (e) {
      if (logScriptOnFailure || !e.isAssert) {
        LOGGER.error(`*** FAIL: ${this.name} - Script was:\n`, source.join('\n'))
      }
      assert.fail(e.stderr)
    } finally {
      let testLog = [];
      if (this.result.stderr) {
        testLog.push(
          'SH_DEBUG:',
          this.result.stderr,
          'END_DEBUG',
        )
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

  #testFileName() {
    if (!this.#testFileWrapper) {
      this.#testFileWrapper = `${TMP_DIR}/ShellTestRunner/` + randomUUID() + '.sh';
    }
    return this.#testFileWrapper;
  }
}
