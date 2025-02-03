const fs = require('node:fs')

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
    //current value is not an option, but positional
    //check if there is a validator for this (next) position (1-starting index)
    if (config === false) { config = options.getConfig(context.numArgs() + 1) }

    if (config === false) {
      context.addArgument(value);
      continue
    }

    let validationStart = (config.isPositional()) ? i : i + 1;
    let restArgs = args.slice(validationStart);

    let validationResult = config.validator.call(context, ...restArgs);
    if (!validationResult.success) {
      if (config.isSkippablePositional()) {
        validationResult.value = false;
        //consumedArgs 0 in positionals will lead to the same argument being eval'd again
        // because i will effectively be reduced with -1 in the last line of the loop iteration
        validationResult.argsConsumed = 0;
      } else {
        errors.push(value + ': ' + validationResult.value);
        continue;
      }
    }

    let pickedArgs = validationResult.value //either take value as given by validator
      // or pick #argsConsumed arguments from lookahead arguments array
      || restArgs.splice(validationResult.argsConsumed, Number.POSITIVE_INFINITY);

    if (config.isPositional()) { context.addArgument(pickedArgs) }
    else { context.setOptionValue(value, pickedArgs) }
    //skip over consumed args
    i += (validationStart - i + validationResult.argsConsumed - 1);
  }

  for (let [name, conf] of Object.entries(options)) {
    //positionals will be checked once at the end
    if (conf.isPositional()) { continue }
    if (typeof context.options[name] != "undefined") { continue }

    if (conf.required) { errors.push(`${name}: parameter is required`) }
    //FIXME: setting all optionals to false does not work for parameters requiring values?
    //else { context.setOptionValue(name, false) }
  }

  let positionalValidation = options['#POS'].validator(...context.arguments);
  if (!positionalValidation.success) { errors.push(positionalValidation.value) }

  if (errors.length > 0) { throw errors.join('\n') }

  return context;
}

class OptionConfig {
  getConfig(rawArgValue) {
    let propName = OptionConfig.cleanName(rawArgValue);
    return this[propName] || false;
  }
  getOptions() { return this.#filter(_ => !_.isPositional()) }
  getPositionals() { return this.#filter(_ => _.isPositional()) }
  getRequired() { return this.#filter(_ => _.isRequired()) }

  #filter(criteria) {
    let result = {};
    for (let [name, option] of Object.entries(this)) {
      if (criteria(option)) { result[name] = option }
    }
    return result;
  }
  static cleanName(rawArgValue) {
    if (String(rawArgValue).startsWith('*')) { rawArgValue = rawArgValue.replace('*', '') }

    let asNumber = parseInt(rawArgValue);
    if (asNumber >= 0 && String(asNumber) == rawArgValue) { rawArgValue = asNumber }

    return rawArgValue;
  }
}

class ConfigEntry {
  constructor(cfgName, isRequired, validatorFun) {
    this.name = cfgName;
    this.required = isRequired;
    this.validator = validatorFun;
  }

  isPositional() { return this.name == '#POS' || Number.isInteger(this.name) }
  isSkippablePositional() {
    return !this.required && this.isPositional()
      && this.validator.positionalSkippable();
  }

  isRequired() {
    if (this.isPositional()) { return !this.isSkippablePositional() }
    else { return this.required }
  }

  optDesc() {
    let description = this.validator.call(VALIDATORS);
    if (!this.isPositional()) { description = this.name + ' ' + description }
    if (!this.isRequired()) { description = '[' + description.trim() + ']' }
    return description;
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

  static of(success, consumedArgs, value) { return new ValidatorResult(success, consumedArgs, value) }
}

const VALIDATORS = new Proxy({
  argsRemaining: function(numArgs, ...argArray) {
    if (this == VALIDATORS) { return [...Array(numArgs)].map((v, i) => 'arg' + (i + 1)).join(' ') }
    // For flag-type options. Validator being called means the flag is in the arg array
    // numArgs 0 means: do not bind any more following args as value to the option
    // This is pointless for positional checks as it would mean:
    // positional with number 'name' must be there, but its value is ignored
    // and not added to positionalArgs. Instead 'true' is added
    if (numArgs == 0) { return ValidatorResult.of(true, 0, true) }

    if (argArray.length >= numArgs) {
      let result = argArray.slice(0, numArgs);
      if (numArgs == 1 && result.length == 1) { result = result.shift() }
      return ValidatorResult.of(true, numArgs, result);
    }
    return ValidatorResult.forSimpleResult(`requires ${numArgs} arguments`);
  },
  includesFirst: function(includesArray, firstArg = '') {
    //#SKIPPABLE
    if (this == VALIDATORS) { return includesArray.join('|') }

    if (!includesArray.includes(firstArg)) {
      return ValidatorResult.forSimpleResult(`<${firstArg}> must be one of [${includesArray.join('|')}]`);
    } else {
      return ValidatorResult.of(true, 1, firstArg);
    }
  },
  regExp: function(expression, firstArg = '') {
    //#SKIPPABLE
    if (this == VALIDATORS) { return '=' + String(expression) }

    return ValidatorResult.forSimpleResult(
      expression.exec(firstArg)
      || `<${firstArg}> must match ${expression}`);
  },
  commaList: function(firstArg = '') {
    if (this == VALIDATORS) { return 'arg1[,arg2]...' }

    return ValidatorResult.forSimpleResult(
      firstArg.trim().length == 0
        ? `csv-value expected - <${firstArg}> must contain at least one none-whitespace character`
        : String(firstArg).split(',')
    );
  },
  varArgs: function(pickArgumentCondition, ...argArray) {
    if (this == VALIDATORS) { return '<conditional:[arg1] [arg2] [...]>' }

    if (typeof pickArgumentCondition != "function") {
      return ValidatorResult.of(false, 0, '[coding error] varArgs validation requires an iterative test function during definition')
    }
    let firstNonIncluded = argArray.findIndex((e, i, a) => {
      return !pickArgumentCondition(e, i, a);
    });
    let resultingArray = firstNonIncluded < 0 ? argArray : argArray.slice(0, firstNonIncluded);
    return ValidatorResult.of(true, resultingArray.length, resultingArray);
  },
  file: function(firstArg = '') {
    //#SKIPPABLE
    if (this == VALIDATORS) { return 'existing/file/path' }

    if (!fs.exists(firstArg)) { return ValidatorResult.of(false, 0, `${firstArg} does not exist`); }
    let stat = fs.statSync(firstArg);
    return ValidatorResult.forSimpleResult(stat.isFile() || `${firstArg} is not a regular file`);
    /*if (stat.isFile()) { return ValidatorResult.of(true, 1, firstArg); }
    return ValidatorResult.of(false, 1, `${firstArg} is not a regular file`);*/
  },
  customFunction: function(customValidator, ...argArray) {
    if (this == VALIDATORS) {
      if (typeof VALIDATORS[customValidator.name] == "function") { return customValidator.call(this) }
      else { return '<function arguments>' }
    }
    return ValidatorResult.forSimpleResult(customValidator.call(this, ...argArray));
  }
}, {
  get(target, prop, receiver) { return _pseudoBind.bind(null, prop, target[prop]) }
});

/**
 * Bind does not allow to change this, but the resulting validator must be able to receive another this.
 */
function _pseudoBind(valName, validator, ...rest) {
  let valWrapper = {
    [valName]: function(...validationArgs) { return validator.call(this, ...rest, ...validationArgs) }
  }
  let unpacked = valWrapper[valName];
  if (valName == "customFunction") { unpacked.toString = function() { return rest[0].toString() } }
  else { unpacked.toString = function() { return validator.toString() } }
  unpacked.positionalSkippable = function() {
    return (unpacked.toString().split('\n')[1] || '').trim() == "//#SKIPPABLE"
  }
  return unpacked;
}

function processOptionConfig(rawOptions) {
  let processed = new OptionConfig();
  let requiredPositional = rawOptions['#POS'] || 0;
  let highestPositional = requiredPositional;
  delete rawOptions['#POS'];
  for (let [optionName, setting] of Object.entries(rawOptions)) {
    let isRequired = optionName.startsWith('*');
    optionName = OptionConfig.cleanName(optionName);
    let isPositional = Number.isInteger(optionName);

    let help = [];
    if (isPositional) {
      highestPositional = Math.max(highestPositional, optionName);
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
        validator = VALIDATORS.argsRemaining(setting);
        break
      case 'array':
        validator = VALIDATORS.includesFirst(setting);
        break
      case 'string':
        if (setting == 'csv') {
          validator = VALIDATORS.commaList();
          break
        }
        setting = new RegExp(setting);
      case 'object':
        if (setting instanceof RegExp) {
          validator = VALIDATORS.regExp(setting);
        }
        break
      case 'function':
        if (typeof VALIDATORS[setting.name] == "function") { validator = setting }
        else { validator = VALIDATORS.customFunction(setting) }
        break
    }

    if (typeof validator == "undefined") {
      throw 'Command line option configuration only accepts [number, array, string(regex), RegExp, function]';
    }

    processed[optionName] = new ConfigEntry(optionName, isRequired, validator);
  }
  processed['#POS'] = Object.assign(new ConfigEntry('#POS', requiredPositional > 0,
    VALIDATORS.argsRemaining(requiredPositional)), {
    amount: requiredPositional,
    optDesc: false
  })
  for (let i = 1; i <= Math.max(requiredPositional, highestPositional); i++) {
    let posCfg = processed.getConfig(i) || new ConfigEntry(i, false, VALIDATORS.argsRemaining(i))
    posCfg.required = i <= requiredPositional;
    posCfg.required = !posCfg.isSkippablePositional()
    processed[i] = posCfg;
  }

  return processed;
}

function action(options, realFunction, documentation) {
  options = processOptionConfig(options);
  function realCallWrapper() {
    try {
      let cmdLine = parseCmdLineNew(options, ...arguments);
      return realFunction(cmdLine.options, ...cmdLine.arguments);
    } catch (e) {
      console.error('error while trying to parse or run command line')
      console.error(e);
    }
  }
  realCallWrapper.options = options;
  realCallWrapper.description = function(cmdName) {
    console.log('***', cmdName, '***');
    if (typeof documentation == "string") { console.log(documentation) }
    console.log('\nUsage:');
    let optionSpec = Object.values(options.getOptions()).map(o => o.optDesc()).join(' ');
    let positionalSpec = Object.values(options.getPositionals()).filter(_ => typeof _.optDesc == "function").map(_ => _.optDesc()).join(' ');
    process.stdout.write(`  ${cmdName} ${optionSpec} ${positionalSpec}\n\n`);
  }
  return realCallWrapper;
}

module.exports = { action, ValidatorResult, VALIDATORS }
