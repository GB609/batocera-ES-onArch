Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const api = require('config.libs/cmdline-api.js');

enableLogfile();

const logger = require('config.libs/logger.js');
const LOGGER = logger.get("TEST");

const globalConsole = globalThis.console;

function isInt(e) { return /\d+/.test(e) }
function varArgs(validatorFunction) { return api.VALIDATORS.varArgs(validatorFunction) }

function apiFunctionImplementation(opts, ...positionals) {
  return { options: opts, positional: positionals };
}

function assertCommandLineParsing(apiOptionDeclaration, cmdArgs, ...expected) {
  let testApiFunction = api.action(apiOptionDeclaration, apiFunctionImplementation);
  if (typeof expected[0] == "function") {
    let expectedValues = expected.slice(1);
    expected[0](apiOptionDeclaration, testApiFunction, cmdArgs, ...expectedValues);
  } else {
    assertApiArguments(apiOptionDeclaration, testApiFunction, cmdArgs, ...expected);
  }
}

function assertApiArguments(apiOptionDeclaration, testFunction, testFunctionParams, expectedOptions, expectedVarArgs = []) {
  let result = testFunction(...testFunctionParams);
  assert.deepEqual(sanitizeDataObject(result.options), expectedOptions);
  assert.deepEqual(sanitizeDataObject(result.positional), expectedVarArgs);
}

function assertValidationError(apiOptionDeclaration, testFunction, testFunctionParams, errorMessage) {
  testFunction(...testFunctionParams);

  let requiredErrorMessages = Object.keys(apiOptionDeclaration)
    .filter(name => name.startsWith('*'))
    .map(name => `${name.substring(1)}: parameter is required`);

  if (errorMessage) { requiredErrorMessages.unshift(`--testFlag: ${errorMessage}`) }

  let lastLine = [...ApiFunctionGeneratorTests.logCollector.lines].pop() || [""];
  assert.equal(lastLine[0], 'ERROR: ' + requiredErrorMessages.join('\n'));
}

class LogCollector {
  lines = [];
  addLine(realMethod, ...args) {
    this.lines.push(args);
    realMethod(...args);
  }
  reset() { this.lines = [] }
}

class ApiFunctionGeneratorTests {

  static logCollector = new LogCollector();

  static beforeAll() {
    let errorDelegate = this.logCollector.addLine.bind(this.logCollector, globalConsole.error);

    globalThis.console = new Proxy(globalConsole, {
      get(target, prop, receiver) {
        if (prop == "error") { return errorDelegate }
        else { return target[prop] }
      }
    });

    LOGGER.info('patch logger config to intercept output');
    let cmdLineApiLogger = logger.get('cmdline-api.js');
    cmdLineApiLogger.targets[logger.Level.USER] = ['stderr', 'file'];
    cmdLineApiLogger.targets[logger.Level.ERROR] = ['stderr', 'file'];
  }

  static afterAll() { globalThis.console = globalConsole }

  beforeEach() { ApiFunctionGeneratorTests.logCollector.reset() }

  static argsRemainingValidator = parameterized(
    [
      //positional arguments
      [{}, ['--testFlag', 'positional'], {}, ['--testFlag', 'positional']],

      //boolean flags, alone or followed by positional arguments
      [{ '--testFlag': 0 }, [], {}, []],
      [{ '--testFlag': 0 }, ['--testFlag'], { '--testFlag': true }, []],
      [{ '--testFlag': 0 }, ['--testFlag', 'positional'], { '--testFlag': true }, ['positional']],

      //required, but not given
      [{ '*--testFlag': 1 }, [], assertValidationError, ''],
      //required, but missing argument
      [{ '*--testFlag': 1 }, ['--testFlag'], assertValidationError, 'requires 1 arguments'],

      //with one argument, empty and non-empty. The one-argument variant automatically unwraps the parameters array
      [{ '--testFlag': 1 }, ['--testFlag', ''], { '--testFlag': '' }, []],
      [{ '--testFlag': 1 }, ['--testFlag', 'positional'], { '--testFlag': 'positional' }, []],

      //2 arguments. value should always be an array of string
      [{ '--testFlag': 2 }, ['--testFlag', 'positional', 'third'], { '--testFlag': ['positional', 'third'] }, []],
      //2 arguments, followed by one positional
      [{ '--testFlag': 2 }, ['--testFlag', '', 'third'], { '--testFlag': ['', 'third'] }, []],
      //required, but incomplete
      [{ '*--testFlag': 2 }, ['--testFlag'], assertValidationError, 'requires 2 arguments']
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )

  static includesFirstValidator = parameterized(
    [
      //not required, not given
      [{ '--testFlag': ['A', 'B', 'C'] }, [], {}, []],

      //not required, but given with valid values
      [{ '--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'A'], { '--testFlag': 'A' }, []],
      [{ '--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'B', 'third'], { '--testFlag': 'B' }, ['third']],

      //not required, but given incorrectly
      [{ '--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'XXX'], assertValidationError, '<XXX> must be one of [A|B|C]'],

      //required, not given
      [{ '*--testFlag': ['A', 'B', 'C'] }, [], assertValidationError, ''],
      [{ '*--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'XXX', 'third'], assertValidationError, '<XXX> must be one of [A|B|C]']
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )

  static regExValidator = parameterized(
    [
      //not required, not given
      [{ '--testFlag': /\d+/ }, [], {}, []],
      [{ '--testFlag': "[a-z]{2,5}" }, [], {}, []],

      //not required, given correctly
      [{ '--testFlag': /\d+/ }, ['--testFlag', '777'], { '--testFlag': ['777'] }, []],
      [{ '--testFlag': "[a-z]{2,5}" }, ['--testFlag', 'abc'], { '--testFlag': ['abc'] }, []],

      //given, followed by another argument
      [{ '--testFlag': /\d+/ }, ['--testFlag', '777', 'another'], { '--testFlag': ['777'] }, ['another']],
      [{ '--testFlag': "[a-z]{2,5}" }, ['--testFlag', 'abc', 'another'], { '--testFlag': ['abc'] }, ['another']],

      //not required, given incorrectly
      [{ '--testFlag': /\d+/ }, ['--testFlag', 'abc'], assertValidationError, '<abc> must match /\\d+/'],
      [{ '--testFlag': "[a-z]{2,5}" }, ['--testFlag', '777'], assertValidationError, '<777> must match /[a-z]{2,5}/'],

      //required and given, but incorrect
      [{ '*--testFlag': /\d+/ }, ['--testFlag', 'abc'], assertValidationError, '<abc> must match /\\d+/'],
      [{ '*--testFlag': "[a-z]{2,5}" }, ['--testFlag', '777'], assertValidationError, '<777> must match /[a-z]{2,5}/'],

      //required and not given
      [{ '*--testFlag': /\d+/ }, [], assertValidationError, ''],
      [{ '*--testFlag': "[a-z]{2,5}" }, [], assertValidationError, ''],

      //regex pattern with groups
      [{ '--testFlag': /(\d+)([a-z])/ }, ['--testFlag', '77b'], { '--testFlag': ['77b', '77', 'b'] }, []],
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )


  static commaListValidtor = parameterized(
    [
      //not required, not given
      [{ '--testFlag': "csv" }, [], {}, []],

      //not required, but given with valid values
      [{ '--testFlag': "csv" }, ['--testFlag', 'A'], { '--testFlag': ['A'] }, []],
      [{ '--testFlag': "csv" }, ['--testFlag', 'B,C', 'third'], { '--testFlag': ['B', 'C'] }, ['third']],

      //not required, but given incorrectly
      [{ '--testFlag': "csv" }, ['--testFlag', ' '], assertValidationError, 'csv-value expected - < > must contain at least one none-whitespace character'],

      //required, not given
      [{ '*--testFlag': "csv" }, [], assertValidationError, ''],
      [{ '*--testFlag': "csv" }, ['--testFlag', ' \t\n', 'third'], assertValidationError, 'csv-value expected - < \t\n> must contain at least one none-whitespace character']
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )

  static varArgsValidator = parameterized(
    [
      //variations with incomplete option arguments
      [{ '--testFlag': varArgs() }, ['--testFlag'], assertValidationError, '[coding error] varArgs validation requires an iterative test function during definition'],
      [{ '--testFlag': varArgs() }, ['--testFlag', 'someArg'], assertValidationError, '[coding error] varArgs validation requires an iterative test function during definition'],
      [{ '*--testFlag': varArgs() }, ['--testFlag'], assertValidationError, '[coding error] varArgs validation requires an iterative test function during definition'],

      //not required, not given
      [{ '--testFlag': varArgs(isInt) }, [], {}, []],

      //not required, but given with valid values
      [{ '--testFlag': varArgs(isInt) }, ['--testFlag', '54321'], { '--testFlag': ['54321'] }, []],
      //stop at first argument that does not match the testing function
      [{ '--testFlag': varArgs(isInt) }, ['--testFlag', '54', 'third', '32', '1'], { '--testFlag': ['54'] }, ['third', '32', '1']],

      //not required, but given incorrectly
      [{ '--testFlag': varArgs(isInt) }, ['--testFlag', 'abcd'], { '--testFlag': [] }, ['abcd']],

      //required, not given
      [{ '*--testFlag': varArgs(isInt) }, [], assertValidationError, ''],
      [{ '*--testFlag': varArgs(isInt) }, ['--testFlag', 'abcd', 'third'], { '--testFlag': [] }, ['abcd', 'third']]
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )

  static fileValidator = parameterized(
    [
      //not required, not given
      [{ '--testFlag': "file" }, [], {}, []],

      //not required, but given with valid values
      [{ '--testFlag': "file" }, ['--testFlag', __filename], { '--testFlag': __filename }, []],
      [{ '--testFlag': File }, ['--testFlag', __filename, 'third'], { '--testFlag': __filename }, ['third']],

      //not required, but given incorrectly
      [{ '--testFlag': "file" }, ['--testFlag', 'abcd'], assertValidationError, '<abcd> does not exist'],
      [{ '--testFlag': File }, ['--testFlag', LIB_PATH], assertValidationError, `<${LIB_PATH}> is not a regular file`],

      //required, not given
      [{ '*--testFlag': "file" }, [], assertValidationError, ''],
      [{ '*--testFlag': File }, ['--testFlag', 'abcd', 'third'], assertValidationError, '<abcd> does not exist']
    ],
    assertCommandLineParsing,
    "options:${0}, input:${1}"
  )

  generatedHelp() {
    let optionSpecs = [
      '[--optFlag]',
      '--reqOpt arg1',
      '--reqFile existing/file/path',
      '[-pattern =/\\d+/]',
      '[oneOf A|B|C]',
      '-csv-list arg1[,arg2]...'
    ].join(' ');
    let expected = [
      '*** testCommand ***',
      'This is a dummy test api function',
      `\nUsage:\n  testCommand ${optionSpecs} posArg1 posArg2\n\n`
    ].join('\n');

    let options = {
      '--optFlag': 0,
      '*--reqOpt': 1,
      '*--reqFile': File,
      '-pattern': /\d+/,
      'oneOf': ['A', 'B', 'C'],
      '*-csv-list' : 'csv',
      '#POS': 2
    }
    let testApiFunction = api.action(options, apiFunctionImplementation, "This is a dummy test api function");

    testApiFunction.description('testCommand');

    let outputMessage = ApiFunctionGeneratorTests.logCollector.lines.map(subArr => subArr.join(' ')).join('\n');
    assert.deepEqual(outputMessage, expected)
  }
}

runTestClass(ApiFunctionGeneratorTests);
