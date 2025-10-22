import * as fs from 'node:fs';
import spawnSync from 'node:child_process';
import dirname from 'path';
import assert from 'node:assert/strict';

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
  functionVerifiers = {}
  verifiers = []
  fileUnderTest = null;
  testEnv = {}
  testArgs = [];
  preActions = [];
  postActionLines = [];
  constructor(testName) { this.name = testName }

  beforeEach() { }

  afterEach(ctx) {
    if (!this.#executeCalled) {
      ctx.diagnostic("ShellTestRunner.execute() was not called - no test was run");
      assert.fail("ShellTestRunner.execute() was not called - no test was run");
    }

    if (fs.existsSync(this.#testFileWrapper)) { fs.rmSync(this.#testFileWrapper) }
    this.#testFileWrapper = '';
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
  #assertVarPattern(name, value, namePrefix = '') { return `verifyVar "${namePrefix}\\$${name}" "${value}" "$${name}"`; }
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
   * Verify that the given function was called and with the arguments supplied.
   * Does not work in all situations.
   * 1. WORKS: testScript does not declare the function itself (directly or by sourcing)
   * 2. WORKS: testScript declares itself, but test code/function has to be triggered after sourcing,
   *    e.g. when testScript itself is only a library of functions. In that case, the functionVerifier (=redeclaration of function)
   *    can be put into postActions, before the test call is added.
   * 3. WORKS NOT: when testScript and testCode themselves define and use the function immediately
   *    without any way to insert/overwrite the function with a test stub again.
   * 4. bash ignores exit codes of sub-shells if not coded to catch and react on them
   * 5. Can not differentiate multiple invocations (yet)
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
        `echo -e ${(mock.out).replaceAll('\n', '\\n')}` : ''}${mock.err ?
          `echo -e ${(mock.err).replaceAll('\n', '\\n')} >&2` : ''}
  return ${mock.code || 0}
}
export -f ${name}`;
  }

  execute() {
    this.#executeCalled = true;
    let targetFile = this.#testFileName()
    fs.mkdirSync(dirname(targetFile), { recursive: true });
    let source = [];

    source.push(...this.preActions)
    source.push(
      '# some helper functions',
      'function verifyVar {',
      '  local matcher="^${2}$"',
      '  [[ $3 =~ $matcher ]] || {',
      '    echo "::TEST-FAILURE::" >&2',
      '    echo "expected: [$1=\\"$2\\"]" >&2',
      '    echo " but was: [$1=\\"$3\\"]" >&2',
      '    echo "::END-FAILURE::" >&2',
      '    exit 1',
      '  }',
      '}'
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
      let result = spawnSync("bash", {
        //`${targetFile}`, {
        //shell: "/bin/bash",
        env: this.testEnv,
        encoding: 'utf8',
        input: source.join('\n')
      });
      let resultLines = result.stderr.trim().split('\n');
      let failIndex = resultLines.indexOf("::TEST-FAILURE::");
      if (failIndex >= 0) {
        let end = resultLines.indexOf('::END-FAILURE::', failIndex + 1)
        throw { stderr: resultLines.slice(failIndex + 1, end).join('\n') }
      }
      for (let name in this.functionVerifiers) {
        if (!resultLines.includes(`::TEST-FUNCTION::${name}::`)) {
          throw { stderr: `Missing function call: [${name}]` }
        }
      }
      if (result.status > 0) {
        throw { stderr: result.stderr.trim() }
      }
    } catch (e) {
      /*console.error("ERROR", e)
      console.error(source.join('\n'))*/
      assert.fail(e.stderr)
    }

  }

  #testFileName() {
    if (!this.#testFileWrapper) {
      this.#testFileWrapper = `${TMP_DIR}/ShellTestRunner/` + require('node:crypto').randomUUID() + '.sh';
    }
    return this.#testFileWrapper;
  }
}
