const fs = require('node:fs');
const { extname } = require('node:path');

const { mergeObjects, deepKeys } = require('./data-utils.js');
const { parseDict, PARSE_FUNCTIONS } = require('./parsing.js');
const writer = require('./output-formats.js');

const INBUILD_CONFIG_PATH = "/opt/batocera-emulationstation/conf.d"
const DROPIN_PATH = "/etc/batocera-emulationstation"

function generateGlobalConfig(){
  let systems = mergeDropinsToInbuild(INBUILD_CONFIG_PATH+"/es_systems.yml", DROPIN_PATH+"/systems.conf.d");
  let features = mergeDropinsToInbuild(INBUILD_CONFIG_PATH+"/es_features.yml", DROPIN_PATH+"/features.conf.d");
}

function mergeDropinsToInbuild(base, dropinDir){
  let mergedDropins = {};
  let validConfigFiles = fs.readdirSync(dropinDir, {withFileTypes:true})
    .filter(_=>_.isFile() || _.isLink())
    .filter(_=>PARSE_FUNCTIONS.includes(extname(_)))
    .map(_=>_.name).sort();
  
  validConfigFiles.forEach(confFile => {
    let currentDict = parseDict(dropinDir+'/'+confFile);
    mergeObjects(mergedDropins, currentDict, true);
  });

  if(!Array.isArray(base)){ base = [base] }
  let baseConfig = {};
  base.forEach(baseFile => { 
    if(!fs.existsSync(baseFile)) { return }
    mergeObjects(baseConfig, parseDict(baseFile), true) 
  });
  
  let result = {};
  deepKeys(mergedDropins).forEach(hk => {
    //manual deepMerge with Hier..Keys ??
    let calculated = hk.get(mergedDropins, null);
    let defaultValue = hk.get(baseConfig, null);
  });
  for(let [key, dropin] of Object.entries(mergedDropins)){
    result[key] = mergeObjects(baseConfig[key] || {}, dropin);
  }
  
  return result;
}

module.exports = {
  generateGlobalConfig
}
