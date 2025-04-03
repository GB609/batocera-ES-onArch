const assert = require('node:assert/strict');
const api = requireSrc('./config.libs/cmdline-api.js');

const globalConsole = globalThis.console;

function apiFunctionImplementation(opts, ...positionals){
  return { options: opts, positional: positionals };
}

function stringifyApiActionParameters(allTestsDict, parameterizedTestFunction, opts, args){
  return `options:${JSON.stringify(opts)}, input:${JSON.stringify(args)}`;
}

function assertCommandLineParsing(apiOptionDeclaration, cmdArgs, ...expected){
  let testApiFunction = api.action(apiOptionDeclaration, apiFunctionImplementation);
  if(typeof expected[0] == "function"){
    let expectedValues = expected.slice(1);
    expected[0](apiOptionDeclaration, testApiFunction, cmdArgs, ...expectedValues);
  } else {
    assertApiArguments(apiOptionDeclaration, testApiFunction, cmdArgs, ...expected);
  }
}

function assertApiArguments(apiOptionDeclaration, testFunction, testFunctionParams, expectedOptions, expectedVarArgs = []){
  let result = testFunction(...testFunctionParams);
  assert.deepEqual(sanitizeDataObject(result.options), expectedOptions);
  assert.deepEqual(sanitizeDataObject(result.positional), expectedVarArgs);
}

function assertValidationError(apiOptionDeclaration, testFunction, testFunctionParams, errorMessage){
  testFunction(...testFunctionParams);

  let requiredErrorMessages = Object.keys(apiOptionDeclaration)
    .filter(name => name.startsWith('*'))
    .map(name => `${name.substring(1)}: parameter is required`);

  if(errorMessage){ requiredErrorMessages.unshift(`--testFlag: ${errorMessage}`) }
  
  let lastLine = [...ApiFunctionGeneratorTests.logCollector.lines].pop();
  assert.equal(lastLine[0], 'ERROR: ' + requiredErrorMessages.join('\n'));
}

class LogCollector {
  lines = [];
  addLine(realMethod, ...args){ 
    this.lines.push(args);
    realMethod(...args);
  }
  reset(){ this.lines = [] }
}

class ApiFunctionGeneratorTests {

  static logCollector = new LogCollector();

  static beforeAll(){
    let errorDelegate = this.logCollector.addLine.bind(this.logCollector, globalConsole.error);
    
    globalThis.console = new Proxy(globalConsole, {
      get(target, prop, receiver){
        if(prop == "error"){ return errorDelegate }
        else { return target[prop] }
      }
    })
  }

  static afterAll(){ globalThis.console = globalConsole }

  beforeEach(){ ApiFunctionGeneratorTests.logCollector.reset() }
  
  static argsRemainingValidator = parameterized(
    [
      //positional arguments
      [ {},  [ '--testFlag', 'positional' ], {},  [ '--testFlag', 'positional' ] ],

      //boolean flags, alone or followed by positional arguments
      [ { '--testFlag' : 0 }, [], {}, [] ],
      [ { '--testFlag' : 0 }, [ '--testFlag' ], { '--testFlag':true }, [] ],
      [ { '--testFlag' : 0 }, [ '--testFlag', 'positional' ], { '--testFlag':true },  ['positional'] ],

      //required, but not given
      [ { '*--testFlag' : 1 }, [ ], assertValidationError, '' ],
      //required, but missing argument
      [ { '*--testFlag' : 1 }, [ '--testFlag' ], assertValidationError, 'requires 1 arguments' ],

      //with one argument, empty and non-empty. The one-argument variant automatically unwraps the parameters array
      [ { '--testFlag' : 1 }, [ '--testFlag', '' ], { '--testFlag':''}, [] ],
      [ { '--testFlag' : 1 }, [ '--testFlag', 'positional' ], { '--testFlag':'positional'}, [] ],

      //2 arguments. value should always be an array of string
      [ { '--testFlag' : 2 }, [ '--testFlag', 'positional', 'third' ], { '--testFlag':['positional', 'third'] }, [] ],
      //2 arguments, followed by one positional
      [ { '--testFlag' : 2 }, [ '--testFlag', '', 'third' ], { '--testFlag':['', 'third'] }, [] ],
      //required, but incomplete
      [ { '*--testFlag' : 2 }, [ '--testFlag' ], assertValidationError, 'requires 2 arguments' ]
    ],
    assertCommandLineParsing,
    stringifyApiActionParameters
  )

  static includesFirstValidator = parameterized(
    [
      //not required, not given
      [ { '--testFlag' : ['A', 'B', 'C'] }, [], { },  [] ],

      //not required, but given with valid values
      [ { '--testFlag' : ['A', 'B', 'C'] }, [ '--testFlag', 'A' ], { '--testFlag':'A' },  [] ],
      [ { '--testFlag' : ['A', 'B', 'C'] }, [ '--testFlag', 'B', 'third' ], { '--testFlag':'B' }, [ 'third' ] ],

      //not required, but given incorrectly
      [ { '--testFlag' : ['A', 'B', 'C'] }, [ '--testFlag', 'XXX' ], assertValidationError, '<XXX> must be one of [A|B|C]' ],
      
      //required, not given
      [ { '*--testFlag' : ['A', 'B', 'C'] }, [], assertValidationError, '' ],
      [ { '*--testFlag' : ['A', 'B', 'C'] }, [ '--testFlag', 'XXX', 'third' ], assertValidationError, '<XXX> must be one of [A|B|C]' ]
    ],
    assertCommandLineParsing,
    stringifyApiActionParameters
  )

    static regExValidator = parameterized(
    [
      //not required, not given
      [ { '--testFlag' : /\d+/ }, [], { },  [] ],
      [ { '--testFlag' : "[a-z]{2,5}" }, [], { },  [] ],

      //not required, given correctly
      [ { '--testFlag' : /\d+/ }, [  '--testFlag', '777' ], { '--testFlag':['777'] },  [] ],
      [ { '--testFlag' : "[a-z]{2,5}" }, [ '--testFlag', 'abc' ], { '--testFlag':['abc'] },  [] ],

      //given, followed by another argument
      [ { '--testFlag' : /\d+/ }, [ '--testFlag', '777', 'another' ], { '--testFlag':['777'] },  ['another'] ],
      [ { '--testFlag' : "[a-z]{2,5}" }, [ '--testFlag', 'abc', 'another' ], { '--testFlag':['abc'] },  ['another'] ],

      //not required, given incorrectly
      [ { '--testFlag' : /\d+/ }, [ '--testFlag', 'abc' ], assertValidationError,  '<abc> must match /\\d+/' ],
      [ { '--testFlag' : "[a-z]{2,5}" }, [ '--testFlag', '777' ], assertValidationError,  '<777> must match /[a-z]{2,5}/' ],
      
      //required and given, but incorrect
      [ { '*--testFlag' : /\d+/ },[ '--testFlag', 'abc' ], assertValidationError,  '<abc> must match /\\d+/' ],
      [ { '*--testFlag' : "[a-z]{2,5}" }, [ '--testFlag', '777' ], assertValidationError,  '<777> must match /[a-z]{2,5}/'  ],

      //required and not given
      [ { '*--testFlag' : /\d+/ }, [], assertValidationError,  '' ],
      [ { '*--testFlag' : "[a-z]{2,5}" }, [], assertValidationError,  ''  ],
    ],
    assertCommandLineParsing,
    stringifyApiActionParameters
  )
}

runTestClass(ApiFunctionGeneratorTests);
