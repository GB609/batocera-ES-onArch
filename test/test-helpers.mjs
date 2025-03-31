import { suite, test, before, after, beforeEach, afterEach } from 'node:test';

function type(something){
  if(Array.isArray(something)){
    return "array"
  }
  return typeof something;
}
const TYPE_STRINGIFIER = {
  function: (fn)=>fn.name,
  array: (arr)=>arr.map(stringify).join(', '),
  object: JSON.stringify,
  string: str => `"${str}"`
}
function stringify(something){
  let valType = type(something);
  let stringifier = TYPE_STRINGIFIER[valType] || String
  return stringifier(something);
}

function defaultParameterizedNameBuilder(testDict, testFunction, ...parameters) {
  let index = Object.entries(testDict).length;
  return `${testFunction.name}[${index}] - [${stringify(parameters)}]`;
}

export function parameterized(parameterList, testFunction, nameBuilder = defaultParameterizedNameBuilder) {
  let testDict = {}
  for (let constellation of parameterList) {
    let params = [];
    if (Array.isArray(constellation)) { params = [...constellation] }
    else { params = [constellation] }

    let name = nameBuilder(testDict, testFunction, ...params)
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

function CallingModuleName(){
  Error.captureStackTrace(this);
  this.nonameCounter = 0;
  this.toString = function(){ return this.getCallingModuleName() };

  this.getCallingModuleName = function(){
    let lines = this.stack.split('\n');
    for(let l of lines){
      if(/Error|.*\/test-helpers.mjs\:.*/.test(l)) { continue }
      let match = /at .* \((.*js)\:\d+\:\d+\)/.exec(l);
      if(match){ return match[1]; }
    }
    return __filename + `_${this.nonameCounter++}`;
  }
}

export function runTestClasses(name, ...classes){
  if(typeof name != "string"){
    classes = [name, ...classes];
    name = new CallingModuleName().toString();
  }

  console.log("run test classes:", classes)
  suite(name, () => {
    classes.forEach(runTestClass);
  });
}
