class OptionDict {
  constructor() {
    this.options = {};
    this.arguments = [];
  }
  setOptionValue(opt, val) { this.options[opt] = val }
  addArgument(arg) { this.arguments.push(arg) }
  numArgs() { return this.arguments.length }
}

function parseCmdLineNew(options, ...args) {
  let errors = [];
  let context = new OptionDict();
  //positive matching in given command line
  for (let i = 0; i < args.length; i++) {
    let value = args[i];
    let config = options.getConfig(value);
    if (config === false) {
      config = options.getConfig(positionalArgs.length + 1);
    }

    if (config === false) {
      context.addArgument(value);
      continue
    }

    let validationStart = (config.type == 'positional') ? i : i + 1;
    let restArgs = args.slice(validationStart);

    let validationResult = config.validator.call(context, ...restArgs);
    if (!validationResult.success) {
      errors.push(validationResult.value);
      continue;
    }

    let pickedArgs = validationResult.value
      || restArgs.splice(validationResult.argsConsumed, Number.POSITIVE_INFINITY);

    if (validationResult == 0) {
      calculatedOptions[value] = true;
      continue;
    }

    let targetArray = (config.type == 'positional' ? positionalArgs
      : (calculatedOptions[value] ||= []))
    targetArray.push(...restArgs);
    //skip over consumed args
    i += (validationStart - i + validationResult - 1);
  }

  for (let [name, conf] of Object.entries(options)) {
    //positionals will be checked once at the end
    if (conf.type != 'option') { continue }
    if (typeof calculatedOptions[name] != "undefined") { continue }

    if (conf.required) {
      errors.push(`parameter ${name} is required`);
    } else {
      calculatedOptions[name] = false;
    }
  }
}

function parseCmdLine(options, ...args) {
  let preprocessedArgs = [];
  let calulatedOptions = {};
  let errors = [];
  //positive matching in given command line
  for (let i = 0; i < args.length; i++) {
    let value = args[i];
    let numArgs = options[value];

    if (Array.isArray(numArgs)) {
      if (numArgs.includes(args[i + 1])) { numArgs = 1 }
      else {
        errors.push(`${value} must be one of [${numArgs.join('|')}]`);
        i++
        continue;
      }
    }

    if (Number.isInteger(numArgs)) {
      if (numArgs == 0) {
        calulatedOptions[value] = true;
      } else {
        calulatedOptions[value] = args.slice(i + 1, i + 1 + numArgs);
        i += numArgs;
      }
    } else {
      preprocessedArgs.push(value);
    }
  }

  if (errors.length > 0) { throw errors.join('\n') }

  //do the reverse, flags that don't appear will be set to false and everything needing parameters is set to an empty array
  for (let [key, value] of Object.entries(options)) {
    if (typeof calulatedOptions[key] != "undefined") { continue }

    if (value === 0) { calulatedOptions[key] = false; }
    else if (Number.isInteger(value) && value > 0) { calulatedOptions[key] = []; }
  }

  return { opt: calulatedOptions, args: preprocessedArgs };
}

class OptionConfig {
  getConfig(rawArgValue) {
    let propName = OptionConfig.cleanName(rawArgValue);
    return this[propName] || false;
  }
  getOptions() { return this.#filter(_ => _.type == 'option') }
  getPositionals() { return this.#filter(_ => _.type == 'positional') }
  getRequired() { return this.#filter(_ => _.required) }

  #filter(criteria) {
    let result = {};
    for (let [name, option] of Object.entries(this)) {
      if (criteria(option)) { result[name] = option }
    }
    return result;
  }
  static cleanName(rawArgValue) {
    if (String(rawArgValue).startsWith('*')) {
      rawArgValue = rawArgValue.replace('*', '')
    }
    let asNumber = parseInt(rawArgValue);
    if (asNumber >= 0 && String(asNumber) == rawArgValue) {
      rawArgValue = asNumber;
    }
    return rawArgValue;
  }
}

class ValidatorResult {

  constructor(successful, numArgs, adjustedValue) {
    this.success = successful;
    this.argsConsumed = numArgs;
    this.value = adjustedValue;
  }

  static forSimpleResult(rawSimpleValidatorResult) {
    if (rawSimpleValidatorResult instanceof ValidatorResult) { return rawSimpleValidatorResult }

    let success = true;
    let argsConsumed = 1;
    let transformedValue;

    switch (typeof rawSimpleValidatorResult) {
      case "string":
        success = false;
        transformedValue = rawSimpleValidatorResult;
        break;
      case "boolean":
        if (rawSimpleValidatorResult === false) {
          success = false
        }
        break;
      case "number":
        success = true;
        argsConsumed = rawSimpleValidatorResult;
        break;
      case 'object':
        success = true;
        transformedValue = rawSimpleValidatorResult;
        break;
      case 'undefined':
      default:
        success = false;
        transformedValue = 'validator function returned no valid result';
        break;
    }
    return new ValidatorResult(success, argsConsumed, transformedValue);
  }

  static of(success, consumedArgs, value) {
    return new ValidatorResult(success, consumedArgs, value);
  }
}

const VALIDATORS = new Proxy({
  argsRemaining: function(name, numArgs, ...argArray) {
    // For flag-type options. Validator being called means the flag is in the arg array
    // numArgs 0 means: do not bind any more following args as value to the option
    // This is pointless for positional checks as it would mean:
    // positional with number 'name' must be there, but its value is ignored
    // and not added to positionalArgs. Instead 'true' is added
    if (numArgs == 0) { return ValidatorResult.of(true, 0, true) }
    //
    if (argArray.length >= numArgs) {
      return ValidatorResult.of(true, numArgs, argArray.slice(0, numArgs));
    }
    return ValidatorResult.forSimpleResult(
      Number.isInteger(name) && numArgs == 1
        ? `Positional argument ${name} must not be empty`
        : `<${name}> requires ${numArgs} arguments`);
  }
  ,
  includesFirst: function(includesArray, firstArg = '') {
    return ValidatorResult.forSimpleResult(
      includesArray.includes(firstArg)
      || `<${firstArg}> must be one of [${includesArray.join('|')}]`
    );
  },
  regExp: function(expression, firstArg = '') {
    return ValidatorResult.forSimpleResult(
      expression.match(firstArg)
      || `<${firstArg}> must match ${expression}`);
  },
  commaList: function(firstArg = '') {
    return ValidatorResult.forSimpleResult(
      firstArg.trim().length == 0
        ? `comma-sep list <${firstArg}> must contain at least one none-whitespace character`
        : String(firstArg).split(',')
    );
  },
  varArgs: function(pickArgumentCondition, ...argArray) {
    if (typeof pickArgumentCondition != "function") {
      return ValidatorResult.of(false, 0, '[coding error] varArgs validation requires an iterative test function during definition')
    }
    let firstNonIncluded = argArray.findIndex((e, i, a) => {
      return !pickArgumentCondition(e, i, a);
    });
    let resultingArray = firstNonIncluded < 0 ? argArray : argArray.slice(0, firstNonIncluded);
    return ValidatorResult.of(true, resultingArray.length, resultingArray);
  },

  customFunction: function(customValidator, ...argArray) {
    return ValidatorResult.forSimpleResult(customValidator(...argArray));
  }
}, {
  get(target, prop, receiver) {
    return target[prop].bind.bind(target[prop], null);
  }
});

function processOptionConfig(rawOptions) {
  let processed = new OptionConfig();
  let requiredPositional = rawOptions['#POS'] || 0;
  delete rawOptions['#POS'];
  for (let [optionName, setting] of Object.entries(rawOptions)) {
    let isRequired = optionName.startsWith('*');
    optionName = OptionConfig.cleanName(optionName);
    let isPositional = Number.isInteger(optionName);

    let help = [];
    if (isPositional) {
      isRequired = isRequired || (optionName <= requiredPositional);
      if (isRequired) {
        requiredPositional = Math.max(requiredPositional, optionName);
      }
    } else {
      help.push(optionName);
    }

    let validator;
    let configType = Array.isArray(setting) ? 'array' : typeof setting;
    switch (configType) {
      case 'number':
        validator = VALIDATORS.argsRemaining(optionName, setting);
        help.push([...Array(setting)].map((v, i) => 'arg' + i).join(' '));
        break
      case 'array':
        validator = VALIDATORS.includesFirst(setting);
        help.push(setting.join('|'));
        break
      case 'string':
        setting = new RegExp(setting);
      case 'object':
        if (setting instanceof RegExp) {
          validator = VALIDATORS.regExp(setting);
          help.push(setting.toString());
        }
        break
      case 'function':
        validator = VALIDATORS.customFunction(setting);
        help.push(setting.argDescription || '<function arguments>');
        break
    }

    if (typeof validator == "undefined") {
      throw 'Command line option configuration only accepts [number, array, string(regex), RegExp, function]';
    }

    processed[optionName] = {
      required: isRequired,
      validator: validator,
      type: (isPositional) ? 'positional' : 'option',
      optDesc: function() { return this.required ? help.join(' ') : `[${help.join(' ')}]` }
    }
  }
  processed['#POS'] = {
    required: requiredPositional > 0,
    validator: VALIDATORS.argsRemaining('unbound positional', requiredPositional),
    amount: requiredPositional,
    type: 'positional',
    optDesc: false
  }
  for (let i = 1; i <= requiredPositional; i++) {
    let posCfg = processed.getConfig(i) || {
      validator: VALIDATORS.argsRemaining(i, requiredPositional),
      type: 'positional',
      optDesc: function() { return 'arg' + i }
    };
    posCfg.required = true;
  }

  return processed;
}

function action(options, realFunction, documentation) {
  options = processOptionConfig(options);
  function realCallWrapper() {
    try {
      let cmdLine = parseCmdLine(options, ...arguments);
      return realFunction(cmdLine.opt, ...cmdLine.args);
    } catch (e) {
      console.error(e)
    }
  }
  realCallWrapper.options = options;
  realCallWrapper.description = function(cmdName) {
    if (typeof documentation == "string") { console.log(documentation) }
    //FIXME 
    console.log('Usage:');
    process.stdout.write(optionsToCmdLine(options));
  }
  return realCallWrapper;
}

function action(options, realFunction, documentation) {
  function realCallWrapper() {
    try {
      let cmdLine = parseCmdLine(options, ...arguments);
      return realFunction(cmdLine.opt, ...cmdLine.args);
    } catch (e) {
      console.error(e)
    }
  }
  realCallWrapper.description = documentation;
  return realCallWrapper;
}

module.exports = { action, ValidatorResult, VALIDATORS }
