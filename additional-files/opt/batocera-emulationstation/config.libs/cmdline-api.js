function parseCmdLine(options, ...args){
  let preprocessedArgs = [];
  let calulatedOptions = {}
  for(let i = 0; i < args.length; i++){
    let value = args[i];
    let numArgs = options[value];
    if(Number.isInteger(numArgs)){
      if(numArgs == 0){
        calulatedOptions[value] = true;
      } else {
        calulatedOptions[value] = args.slice(i+1, i+1+numArgs);
        i += numArgs;
      }
    } else {
      preprocessedArgs.push(value);
    }
  }

  return {opt: calulatedOptions, args : preprocessedArgs};
}

function apiFunction(options, realFunction, documentation){
  let apiFun = function(){
    let cmdLine = parseCmdLine(options, ...arguments);
    return realFunction(cmdLine.opt, ...cmdLine.args);  
  }   
  apiFun.description = documentation;
  return apiFun;
}
