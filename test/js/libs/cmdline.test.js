/**
 * @file
 * This class tests the generation api declaration syntax as found in `cmdline-api`.  
 * It does not test the behaviour of the function/API provided by `btc-config`, it only makes sure
 * that the generic argument type specification and evaluation works as expected.  
 */

Object.assign(globalThis, require('test-helpers.mjs'));

const assert = require('node:assert/strict');
const api = require('cmdline-api');

enableLogfile();

const logger = require('logger');
const { LogCollector } = require('../utils/output-capturing.js');

function isInt(e) { return /\d+/.test(e) }
function varArgs(validatorFunction) { return api.VALIDATORS.varArgs(validatorFunction) }

function apiFunctionImplementation(opts, ...positionals) {
  return { options: opts, positional: positionals };
}

function assertCommandLineParsing(apiOptionDeclaration, cmdArgs, ...expected) {
  let testApiFunction = (...paras) => {
    try { return api.action(apiOptionDeclaration, apiFunctionImplementation)(...paras); }
    catch (e) { }
  };
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

  let lastLine = [...ApiFunctionGeneratorTests.logCollector.lineStrings].pop() || [""];
  assert.equal(lastLine, 'ERROR: ' + requiredErrorMessages.join('\n'));
}

function assertHelp(options, descriptionArguments, expected, useBrief = true) {
  let testApiFunction = useBrief
    ? api.action(options, apiFunctionImplementation, "This is a dummy test api function")
    : api.action(options, apiFunctionImplementation);

  testApiFunction.description('testCommand', ...descriptionArguments);

  let outputMessage = ApiFunctionGeneratorTests.logCollector.lineStrings.join('\n');
  assert.deepEqual(outputMessage, expected)
}

class ApiFunctionGeneratorTests {

  static logCollector = new LogCollector();

  static beforeAll() {
    this.logCollector.patchLogger('cmdline-api.js', [
      logger.Level.USER,
      logger.Level.ERROR,
      logger.Level.API
    ], true);
  }

  static afterAll() { this.logCollector.restoreLoggerConfig() }

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
      //one arg, using extended configuration
      [{ '--testFlag': { argsRemaining: [1, 'parName'] } }, ['--testFlag', 'positional'], { '--testFlag': 'positional' }, []],

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
      [{ '--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'XXX'], assertValidationError, 'must be one of [A|B|C]'],

      //required, not given
      [{ '*--testFlag': ['A', 'B', 'C'] }, [], assertValidationError, ''],
      [{ '*--testFlag': ['A', 'B', 'C'] }, ['--testFlag', 'XXX', 'third'], assertValidationError, 'must be one of [A|B|C]']
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

  static commaListValidator = parameterized(
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

  static #HELPTEST_OPTION_CONF = {
    '--optFlag': 0,
    '*--reqOpt': 1,
    '*--reqFile': File,
    '-pattern': /\d+/,
    'oneOf': ['A', 'B', 'C'],
    '*-csv-list': 'csv',
    '#POS': 2
  };
  static #HELPTEST_OPTION_DOC_NOOPTS = [
    '--reqOpt arg',
    '--reqFile existing/file/path',
    '-csv-list arg1[,arg2]...'
  ].join(' ');
  static #HELPTEST_OPTION_DOC = [
    '[--optFlag]',
    '--reqOpt arg',
    '--reqFile existing/file/path',
    '[-pattern =/\\d+/]',
    '[oneOf A|B|C]',
    '-csv-list arg1[,arg2]...'
  ].join(' ');

  shortHelp() {
    let optionSpecs = ApiFunctionGeneratorTests.#HELPTEST_OPTION_DOC_NOOPTS;
    let expected = [
      '',
      `  * testCommand ${optionSpecs} posArg1 posArg2`,
      '  : This is a dummy test api function'
    ].join('\n');

    assertHelp(ApiFunctionGeneratorTests.#HELPTEST_OPTION_CONF, [], expected);
  }

  /** For argsRemaining validator it is possible to change the argument example names */
  helpCustomizeArgNameByOptionConfig() {
    let optionConfig = Object.assign({}, ApiFunctionGeneratorTests.#HELPTEST_OPTION_CONF);
    optionConfig['*--reqOpt'] = { argsRemaining: [1, 'required'] }
    let optionSpecs = ApiFunctionGeneratorTests.#HELPTEST_OPTION_DOC_NOOPTS.replace('--reqOpt arg', '--reqOpt required');
    let expected = [
      '',
      `  * testCommand ${optionSpecs} posArg1 posArg2`,
      '  : This is a dummy test api function'
    ].join('\n');

    assertHelp(optionConfig, [], expected);
  }

  longHelpNoDetails() {
    let optionSpecs = ApiFunctionGeneratorTests.#HELPTEST_OPTION_DOC;
    let expected = [
      '\n*** testCommand ***',
      'This is a dummy test api function',
      '\nUsage:',
      `  * btc-config testCommand ${optionSpecs} posArg1 posArg2`,
      '\n---'
    ].join('\n');

    assertHelp(ApiFunctionGeneratorTests.#HELPTEST_OPTION_CONF, [true], expected);
  }

  longHelpMoreDetails() {
    let optionSpecs = ApiFunctionGeneratorTests.#HELPTEST_OPTION_DOC;
    let expected = [
      '\n*** testCommand ***',
      'Another summary value',
      '\nUsage:',
      `  * btc-config testCommand ${optionSpecs} posArg1 posArg2`,
      '\nSome more long text\nWith multiple lines',
      '\n---'
    ].join('\n');

    let details = {
      brief: 'Another summary value',
      fullSpec: 'Some more long text\nWith multiple lines'
    }
    assertHelp(ApiFunctionGeneratorTests.#HELPTEST_OPTION_CONF, [true, details], expected, false);
  }
}

runTestClass(ApiFunctionGeneratorTests);
