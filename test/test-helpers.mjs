import { suite, test, before, after, beforeEach, afterEach } from 'node:test';

function type(something) {
  if (Array.isArray(something)) {
    return "array"
  } else if (something instanceof RegExp) {
    return "regex"
  }
  return typeof something;
}
const TYPE_STRINGIFIER = {
  function: (fn) => fn.name,
  regex: (r) => r.toString(),
  array: (arr) => JSON.stringify(arr, stringify).replace(/(?<!\\)"/g, '').replace(/\\"/g, '"'),
  object: (obj) => JSON.stringify(obj, stringify).replace(/(?<!\\)"/g, '').replace(/\\"/g, '"'),
  string: str => `'${str}'`
}
function stringify(something, value) {
  if (something == "") { return value }
  if (typeof value != "undefined") { something = value }
  let valType = type(something);
  let stringifier = TYPE_STRINGIFIER[valType] || String
  return stringifier(something);
}

function defaultParameterizedNameBuilder(testDict, testFunction, ...parameters) {
  let index = Object.entries(testDict).length;
  if (parameters.length == 1) { parameters = parameters.pop() }
  let stringified = `${stringify(parameters)}`;
  return `${testFunction.name}[${index}] - ${stringified}`;
}

export function parameterized(parameterList, testFunction, nameBuilder = defaultParameterizedNameBuilder) {
  let testDict = {}
  for (let constellation of parameterList) {
    let params = [];
    if (Array.isArray(constellation)) { params = [...constellation] }
    else { params = [constellation] }

    let nameParams = [];
    let nameBuilderFunction = nameBuilder;
    switch(type(nameBuilder)){
      case "array":
        for (idx of nameBuilder) {
          nameParams.push(params[idx] || undefined)
        }
        break;
      case 'object':
        let customized = {}
        for (let [key, value] of Object.entries(nameBuilder)) {
          customized[key] = params[value];
        }
        nameParams.push(customized);
        break;
      case 'string':
        let resultingName = nameBuilder;
        params.forEach((value, index) => {
          let keyToReplace = new RegExp(`\\$\\{${index}\\}`, 'g');
          let replacement = stringify(null, value);
          resultingName = resultingName.replace(keyToReplace, replacement);
        })
        nameBuilderFunction = () => resultingName
        break;
      default:
        nameParams.push(...params)
    }

    if (typeof nameBuilderFunction != "function") { nameBuilderFunction = defaultParameterizedNameBuilder }

    let name = nameBuilderFunction(testDict, testFunction, ...nameParams)
    testDict[name] = function() { testFunction(...params) };
  }

  return async function(context) {
    await runTestsFromObject(testDict, this.constructor, context);
  }
}

function NOOP() { }
function defineContext(context = null) {
  if (context == null) {
    console.error("declare new pseudo-context")
    return {
      test: test,
      before: before,
      after: after,
      beforeEach: beforeEach,
      afterEach: afterEach
    }
  }
  return context
}

function executeIfExisting(receiver, functionName, ...params) {
  (receiver[functionName] || NOOP).call(receiver, ...params);
}

async function runTest(testInstance, testMethod, name, testContext = null) {
  Object.defineProperty(testMethod, 'name', { value: name });
  await testMethod.call(testInstance, testContext);
}

async function runTestsFromObject(methodHolder, instanceFactory, contextIn = null) {
  let context = defineContext(contextIn);

  let testInstance = new instanceFactory();
  context.beforeEach(executeIfExisting.bind(null, testInstance, 'beforeEach'));
  context.afterEach(executeIfExisting.bind(null, testInstance, 'afterEach'));
  for (let [name, runner] of Object.entries(methodHolder)) {
    await context.test(name, runTest.bind(null, testInstance, runner, name));
  }
}

async function runTestMethods(testClass, context) {
  let tests = Object.assign({}, Object.getOwnPropertyDescriptors(testClass.prototype));
  Object.assign(tests, Object.getOwnPropertyDescriptors(testClass));

  let filter = ['constructor', 'beforeAll', 'afterAll', 'beforeEach', 'afterEach'];
  let validTests = {};
  for (let [name, desc] of [...Object.entries(tests)]) {
    let value = desc.value;
    if (filter.includes(name)) { continue }
    if (typeof value != "function") { continue }

    validTests[name] = value;
  }

  await runTestsFromObject(validTests, testClass, context);
}

export function runTestClass(testClass) {
  console.log("running class", testClass)
  test(testClass.name, async (context) => {
    before(executeIfExisting.bind(null, testClass, 'beforeAll'));
    await runTestMethods(testClass, context);
    after(executeIfExisting.bind(null, testClass, 'afterAll'));
  });
}

function CallingModuleName() {
  Error.captureStackTrace(this);
  this.nonameCounter = 0;
  this.toString = function() { return this.getCallingModuleName() };

  this.getCallingModuleName = function() {
    let lines = this.stack.split('\n');
    for (let l of lines) {
      if (/Error|.*\/test-helpers.mjs\:.*/.test(l)) { continue }
      let match = /at .* \((.*js)\:\d+\:\d+\)/.exec(l);
      if (match) { return match[1]; }
    }
    return __filename + `_${this.nonameCounter++}`;
  }
}

export function runTestClasses(name, ...classes) {
  if (typeof name != "string") {
    classes = [name, ...classes];
    name = new CallingModuleName().toString();
  }

  suite(name, () => {
    classes.forEach(runTestClass);
  });
}

/** some general assertion helper */
export function sanitizeDataObject(props) { return JSON.parse(JSON.stringify(props.valueOf())) }
