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

module.exports = { action }