import { createRequire } from 'node:module';
import { suite, test, before, after, beforeEach, afterEach } from 'node:test';
import { basename, relative } from 'path'
import * as fs from 'node:fs';

export { suite }

const require = createRequire(import.meta.url);
const { Logger, Level } = require('config.libs/logger');

export const LOGGER = Logger.for("TEST");

/**
 * Set up the global logger configuration to something more suitable to test output on ci/cd:
 * 1. DEBUG and TRACE are disabled
 * 2. Everything else goes into a file named after the test class
 */
export function enableLogfile() {
  let moduleName = basename(new CallingModuleName().toString());

  let loggerConf = {};
  Object.keys(Level).forEach(k => {
    if (k == Level.DEBUG || k == Level.TRACE) { loggerConf[k] = [] }
    else { loggerConf[k] = ['file'] }
  });

  Logger.enableLogfile(`${process.env.RESULT_DIR}/logs/${moduleName}.log`);
  Logger.configureGlobal(Level.API, loggerConf);
}

/** some general assertion helper */
export function sanitizeDataObject(props) { return JSON.parse(JSON.stringify(props.valueOf())) }

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
  string: str => `'${str.replaceAll('\n', '\\n')}'`
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

/**
 * Define a batch of tests from a list of parameters and one test function.
 *
 * Arguments:
 * parameterList : [] of test constellations.
 *                 Every top-level entry in the array denotes one test run/constellation.
 *                 Second level arrays are possible and will be unrolled for convenience.
 * testFunction : Will be called with arguments defined in one entry of parameterList
 * nameBuilder  : By default, test names are generated from constellations by stringifying each parameter of the constellation.
 *                The stringification depends on type and handles a few special cases to keep names short (e.g. not using full function.toString())
 *                This optional parameter allows customization. How it applies depends on the type:
 *                - {key1:idx, key2:idx}: generate key-value-pairs with the given key names and values located under the given index
 *                - [idx1, idx2]: stringify values of selected constellation parameters only
 *                - "text ${idx1}, ${idx2}...": replace '${idx}' with stringified values of the respective constellation parameter
 *                - function(testDict, testFunction, ...parameters): full customization. Called once per constellation and is expected to return a name string
 */
export function parameterized(parameterList, testFunction, nameBuilder = defaultParameterizedNameBuilder) {
  let testDict = {}
  for (let constellation of parameterList) {
    let params = [];
    if (Array.isArray(constellation)) { params = [...constellation] }
    else { params = [constellation] }

    let nameParams = [];
    let nameBuilderFunction = nameBuilder;
    switch (type(nameBuilder)) {
      case "array":
        for (let idx of nameBuilder) {
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
    testDict[name] = async function() { return await testFunction.call(this, ...params) };
  }

  return async function runParameterized(context) {
    await runTestsFromObject(testDict, this.constructor, context);
  }
}

function NOOP() { }
function defineContext(context = null) {
  if (context == null) {
    LOGGER.error("declare new pseudo-context")
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
  LOGGER.debug("try to run", functionName, "against", receiver);
  (receiver[functionName] || NOOP).call(receiver, ...params);
}

let hooksRegistered = [];
async function scheduleTestMethod(realTestMethod, ...testArgs) {
  //test args: [name,] [options,] fn
  if (testArgs.length < 0 || testArgs.length > 3) { throw "Too few or too many arguments!" }
  let testFn = testArgs.splice(-1)[0];

  let options, name;
  if (typeof testArgs.at(-1) == "object") { options = testArgs.splice(-1)[0] }
  else { options = {} }

  if (typeof testArgs.at(-1) == "string") { name = testArgs.splice(-1)[0] }
  else { name = testFn.name }

  const isTopLevel = realTestMethod == test;

  async function delegate(context) {
    let localContext = Object.create(defineContext(context));
    localContext.testInstance ||= {}

    let realTest = context.test;
    // When nesting tests in each other:
    // node seems to run all parent-level beforeEach/afterEach hooks for all subtests recursively
    // but this is not desirable when a test class defines a nested parameterized test
    if (isTopLevel && !hooksRegistered.includes(context)) {
      hooksRegistered.push(context);
      context.beforeEach((ctx) => {
        let instance = (ctx._instances || {})[ctx.name];
        if (typeof instance == "object") { executeIfExisting.call(null, instance, "beforeEach", ctx) }
      })
      context.afterEach((ctx) => {
        let instance = (ctx._instances || {})[ctx.name];
        if (typeof instance == "object") { executeIfExisting.call(null, instance, "afterEach", ctx) }
      })
    }

    context.test = scheduleTestMethod.bind(context, realTest.bind(context));
    await runTest.call(null, localContext.testInstance, testFn, name, context);
  }
  Object.defineProperty(delegate, "name", { value: name });
  return realTestMethod(name, options, delegate);
}
const GLOBAL_scheduleTestMethod = scheduleTestMethod.bind(null, test);
export { GLOBAL_scheduleTestMethod as test }

async function runTest(testInstance, testMethod, name, testContext = null) {
  Object.defineProperty(testMethod, 'name', { value: name });
  LOGGER.info("BEGIN:", name);
  try { await testMethod.call(testInstance, testContext) }
  finally { LOGGER.info("END:", name) }
}

async function runTestsFromObject(methodHolder, instanceFactory, contextIn = null) {
  let context = defineContext(contextIn);
  let instances = {}
  Object.getPrototypeOf(context)._instances = instances;
  for (let [name, runner] of Object.entries(methodHolder)) {
    let testInstance = new instanceFactory(name);
    instances[name] = testInstance;

    let realTest = runner.bind(testInstance);
    Object.defineProperty(realTest, "name", { value: name })
    await context.test(name, realTest);
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

  return await runTestsFromObject(validTests, testClass, context, testClass.name);
}

export async function runTestClass(testClass, testName = testClass.name) {
  LOGGER.info("running class", testClass);
  if (fs.existsSync(testName)) {
    testName = relative(ROOT_PATH, testName);
  }
  await GLOBAL_scheduleTestMethod(testName, async (context) => {
    context.before(executeIfExisting.bind(null, testClass, 'beforeAll'));
    context.after(executeIfExisting.bind(null, testClass, 'afterAll'));
    await runTestMethods(testClass, context);
  });
}

export async function runTestClasses(name, ...classes) {
  if (typeof name != "string") {
    classes = [name, ...classes];
    name = new CallingModuleName().toString();
  }

  await suite(name, async () => {
    for (let cls of classes) { await runTestClass(cls) }
  });
}

function CallingModuleName() {
  Error.captureStackTrace(this);
  this.nonameCounter = 0;
  this.toString = function() {
    let callingFileName = this.getCallingModuleName();
    return callingFileName.replace(ROOT_PATH, '');
  };
  this.valueOf = this.toString;

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
