/**
 * @file
 * This module contains some helper functions primarily used by `btc-config`.  
 * It is meant to encapsulate logic revolving around handling of controller profiles to prevent 
 * btc-config from growing too large to be readable.
 */

const data = require('./data-utils.js');

/**
 * The json structure created by `xmltodict` is not homogenous. 
 * Repeatable elements only appear as array properties when there's actually more than one entry.
 * Otherwise, they are simple objects. This requires context-sensitive implementations of for additions and lookups with a lot of ifs.  
 * This method aims to equalize the structures: none-array `object`-type children will be converted to arrays.  
 * As long as there is only one entry, the output is identical, but processing it becomes easier. 
 */
function equalizeStructure(xmlDict) {
  Object.entries(xmlDict).forEach(([key, value]) => {
    if (!value) { return }

    let isObject = typeof value.valueOf() == "object";
    let noArray = !Array.isArray(value);
    let notEmpty = !data.isEmpty(value);
    console.error("key:", key, isObject, noArray, notEmpty)
    //use valueOf to not interfere with PropValue types
    if (isObject && noArray && notEmpty) {
      xmlDict[key] = [value]
      equalizeStructure(value);
    } else if (!noArray) {
      value.forEach(equalizeStructure)
      /*for(let i = 0; i < value.length; i++){
        equalizeStructure()
      }*/
    }
  });
  return xmlDict;
}

/**
 * Applies the content of the `GUIDE` profile to the base given here.
 * This translates to the following actions:
 * - The GUIDE button in each set of base will be overwritten with the definition from `GUIDE`.
 * - Set #8 from `GUIDE` will overwrite set #8 from base (or be added if not existing at all). 
 */
function applyGuideProfile(base) {

}

module.exports = { applyGuideProfile, equalizeStructure }