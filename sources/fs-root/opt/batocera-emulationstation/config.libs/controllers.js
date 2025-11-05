/**
 * @file
 * This module contains some helper functions primarily used by `btc-config`.  
 * It is meant to encapsulate logic revolving around handling of controller profiles to prevent 
 * btc-config from growing too large to be readable.
 */

const data = require('./data-utils.js');
const { xmlToDict } = require('./parsing.js');
const qt = require('./qt-keys.js');

const log = require('./logger.js').get();

const MOUSE_BTN_NAMES = {
  1: 'LMB',
  2: 'Mouse Middle',
  3: 'RMB',
  4: 'Wheel Up',
  5: 'Wheel Down',
  6: 'Wheel Left',
  7: 'Wheel Right'
}

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
      equalizeStructure(value, false);
    } else if (isArray) {
      value.forEach(_ => equalizeStructure(_, false));
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
 * This is a helper class to parse the content of an amx profile and extract human readable button-mappings from it.
 */
class ProfileDescriber {
  /**
   * Button label placeholders used in the mapping svg.
   */
  static DEFAULT_LABELS = {
    title: 'Profile',
    //face buttons
    'button1': '', 'button2': '', 'button3': '', 'button4': '',
    // middle buttons
    'button5': '', 'button6': '', 'button7': '',
    //sticks
    'button8': '', 'button9': '',
    //shoulders
    'button10': '', 'button11': '', 'trigger5-2': '', 'trigger6-2': '',
    //left stick
    'stickbutton1-1': '', 'stickbutton1-7': '', 'stickbutton1-3': '', 'stickbutton1-5': '',
    //right stick
    'stickbutton2-1': '', 'stickbutton2-7': '', 'stickbutton2-3': '', 'stickbutton2-5': '',
    //dpad
    'dpadbutton1-1': '', 'dpadbutton1-8': '', 'dpadbutton1-2': '', 'dpadbutton1-4': ''
  }

  constructor(profileXml) {
    this.xml = profileXml.gamecontroller[0];
    this.setNames = {}
    this.xml.sets[0].set.forEach(set => {
      this.setNames[set['@index']] = (set.name || set['@index']).valueOf();
    });
  }

  iterateButtonDefinitions(propertyDict, keyPrefix, buttonList = []) {
    buttonList.forEach(button => {
      propertyDict[`${keyPrefix}${button['@index']}`] = this.buttonNameOrContentDesc(button);
    });
  }

  buttonNameOrContentDesc(button) {
    if (button.actionname && typeof (button.actionname.valueOf() != 'object')) {
      return button.actionname.valueOf();
    }

    try {
      if (button.setselect) {
        return this.describeSlot(Object.assign(button, { mode: 'setselect' }))
      }

      if (button.slots) {
        if (button.slots[0].slot.length > 1) { return 'Macro (define name)' }
        else { return this.describeSlot(button.slots[0].slot[0]); }
      }
    } catch (e) {
      //swallow up errors for now
      console.error(e)
    }

    return '';
  }

  describeSlot(slot) {
    let key = `${slot.mode}`;
    switch (slot.mode.valueOf()) {
      case 'keyboard':
        let charCode = parseInt(slot.code.valueOf());
        key = qt.keyNameFromCode(charCode);
        if (key == null) { key = String.fromCodePoint(charCode) }
        break;
      case 'mousemovement':
        //nothing more to do - keep mousemovement for now
        //Future: Maybe add info about up/down/inverted etc
        break;
      case 'mousebutton':
        key = MOUSE_BTN_NAMES[slot.code];
        break;
      case 'setselect':
        key = `Set '${this.setNames[slot.setselect]}' (${slot.setselectcondition})`;
        break;
    }
    return key;
  }

  extractLabels() {
    let results = [];
    this.xml.sets[0].set.forEach(set => {
      let currentLabels = {
        profileName: this.xml.profilename,
        setName: this.setNames[set['@index']],
        setNum: set['@index'],
        title: `${this.xml.profilename} - Set '${this.setNames[set['@index']]}'`
      };

      this.iterateButtonDefinitions(currentLabels, 'button', set.button);
      getOrNewArr(set, 'stick').forEach(s => {
        let stickIndex = s['@index'];
        let keyPrefix = `stickbutton${stickIndex}-`;
        this.iterateButtonDefinitions(currentLabels, keyPrefix, s.stickbutton);
      });
      getOrNewArr(set, 'dpad').forEach(pad => {
        let padIndex = pad['@index'];
        let keyPrefix = `dpadbutton${padIndex}-`;
        this.iterateButtonDefinitions(currentLabels, keyPrefix, pad.dpadbutton);
      });
      getOrNewArr(set, 'trigger').forEach(trigger => {
        let tIndex = trigger['@index'];
        let keyPrefix = `trigger${tIndex}-`;
        this.iterateButtonDefinitions(currentLabels, keyPrefix, trigger.triggerbutton);
      })

      results.push(currentLabels);
    });

    return results;
  }

}

function replaceVariables(sourceString, valueDict) {
  let result = sourceString;
  Object.entries(valueDict).forEach(([key, value]) => {
    key = `{{${key}}}`
    result = result.replaceAll(key, value)
  });
  return result;
}

/**
 * Takes an amx profile and reads names/keycodes to put them into a template svg to produce controller mapping images.
 * Will generate one image per set.  
 * Resulting files will be named after profile and set name (or number): `ProfileName(SetNumber) - SetName.svg`.  
 * Regardless of there being a set name or not, its number will always be appended to the constant name part to ensure proper ls order.
 * 
 * @param {string|file} baseProfileFile - profile as object, filename or xml source string
 * @param {string} [targetDirectory=XDG_RUNTIME_DIR] - where to place SVGs
 * @param {string} [customNamePrefix] - custom file name. Set number will be appended. 
 */
function profileToImage(profileData, targetDirectory = process.env.XDG_RUNTIME_DIR, customNamePrefix = null) {
  let fs = require('node:fs');
  let cfg = require('./config-import.js');

  log.debug(`Reading profile from ${typeof profileData}`, JSON.stringify(profileData, null, 2));
  if (typeof profileData == "string") { profileData = xmlToDict(profileData) }

  let baseProfile = equalizeStructure(profileData);
  let describer = new ProfileDescriber(baseProfile);
  let allLabels = describer.extractLabels();

  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true })
  }
  let templateFileName = `${cfg.CONFIG_ROOT}/batocera-emulationstation/controller-profiles/image_template.svg`;
  let template_svg = fs.readFileSync(templateFileName, { encoding: 'utf8' });
  let resultingFiles = [];

  allLabels.forEach(setDef => {
    let fullSpec = Object.assign({}, ProfileDescriber.DEFAULT_LABELS, setDef);
    let fileNameToUse = customNamePrefix == null
      ? `${setDef.profileName}(${setDef.setNum}) - ${setDef.setName}`
      : `${customNamePrefix} - ${setDef.setNum}`

    let targetFile = `${targetDirectory}/${fileNameToUse}.svg`;
    let patchedSvg = replaceVariables(template_svg, fullSpec);
    // use async promises to parallelize writing svg files.
    fs.writeFileSync(targetFile, patchedSvg, { encoding: 'utf8' })
    resultingFiles.push(targetFile);
  });
  
  return resultingFiles;
}

module.exports = { profileToImage }