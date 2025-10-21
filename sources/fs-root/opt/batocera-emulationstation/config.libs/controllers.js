/**
 * @file
 * This module contains some helper functions primarily used by `btc-config`.  
 * It is meant to encapsulate logic revolving around handling of controller profiles to prevent 
 * btc-config from growing too large to be readable.
 */

const data = require('./data-utils.js');
const { xmlToDict } = require('./parsing.js');

/**
 * The json structure created by `xmltodict` is not homogenous. 
 * Repeatable elements only appear as array properties when there's actually more than one entry.
 * Otherwise, they are simple objects. This requires context-sensitive implementations of for additions and lookups with a lot of ifs.  
 * This method aims to equalize the structures: none-array `object`-type children will be converted to arrays.  
 * As long as there is only one entry, the output is identical, but processing it becomes easier. 
 */
function equalizeStructure(xmlDict) {
  let keys = Object.keys(xmlDict);
  for (let key of keys) {
    let value = xmlDict[key];
    if (!value) { return }

    let isObject = (typeof value.valueOf()) == 'object';
    let isArray = Array.isArray(value);
    let notEmpty = !data.isEmpty(value);

    //use valueOf to not interfere with PropValue types
    if (isObject && !isArray && notEmpty) {
      xmlDict[key] = [value]
      equalizeStructure(value);
    } else if (isArray) {
      value.forEach(equalizeStructure);
    }
  }
  return xmlDict;
}

function getOrNewArr(dict, key) {
  if (data.isEmpty(dict[key])) {
    dict[key] = []
  }
  return dict[key];
}

/**
 * Aimed at *.amgp files. 
 * Searches the given element array for one entry with `index` as value for the xml tag attribute 'index'.  
 * Assumes regular `*.amgp` format where the index attribute has unique values across siblings of the same nesting level.
 * 
 * @returns first found element or defaultValue
 */
function locateIndexed(arr, index, defaultValue = null) {
  return arr.find(e => e['@index'] == index) || defaultValue
}

/**
 * Applies the content of the `GUIDE` profile to the base given here.
 * This translates to the following actions:
 * - The GUIDE button in each set of base will be overwritten with the definition from `GUIDE`.
 * - Set #8 from `GUIDE` will overwrite set #8 from base (or be added if not existing at all).
 * 
 * When baseProfileFile is given as object, it will be mutated for easier processing.  
 * The mutation will still result in identical XML when the object is converted to XML as per 'xmltodict' spec,
 * but all none-simple key-value entries in all sub-trees will be replaced by key:[value]. E.g:
 * - { a: "b" } -> nothing happens
 * - { a: { subtag: 42} } -> { a: [{ subtag: 42}] } 
 * 
 * @param {string|file} baseProfileFile - profile as object, filename or xml source string 
 */
function applyGuideProfile(baseProfileFile, nameToUse) {
  const setListKey = data.HierarchicKey.from('gamecontroller[0].sets[0].set');
  let BTC_CONFIG_ROOT = require('./config-import').BTC_CONFIG_ROOT;

  let guideProfilePath = `${BTC_CONFIG_ROOT}/controller-profiles/GUIDE.gamecontroller.amgp`;

  if (typeof baseProfileFile == "string") {
    baseProfileFile = xmlToDict(baseProfileFile);
  }
  let baseProfile = equalizeStructure(baseProfileFile);
  let guideProfile = equalizeStructure(xmlToDict(guideProfilePath));

  let controlSets = setListKey.get(guideProfile, []);
  let control8 = locateIndexed(controlSets, '8');

  let sets = getOrNewArr(baseProfile.gamecontroller[0], "sets");
  if (sets.length == 0) { sets[0] = { set: [] } }
  let profileSets = setListKey.get(baseProfile);
  let profileSet8 = locateIndexed(profileSets, '8');

  if (profileSet8 != null) { profileSets[profileSets.indexOf(profileSet8)] = control8 }
  else { profileSets.push(control8) }

  //make sure that there is at least an empty first profile in the target file
  let profileSet1 = locateIndexed(profileSets, '1');
  if (profileSet1 == null) { profileSets.push({ '@index': 1 }) }

  let control1Guide = locateIndexed(locateIndexed(controlSets, '1').button, '6');
  profileSets.filter(s => s['@index'] != 8).forEach(set => {
    let buttonList = getOrNewArr(set, "button");
    let profileGuideIndex = buttonList.findIndex(e => e['@index'] == '6');
    if (profileGuideIndex >= 0) { set.button[profileGuideIndex] = control1Guide }
    else { set.button.push(control1Guide) }
  });

  if (nameToUse) { baseProfile.gamecontroller[0].profilename = nameToUse }

  return baseProfile;
}

module.exports = { applyGuideProfile }