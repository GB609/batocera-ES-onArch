// SPDX-FileCopyrightText: 2026 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

/**
 * @name Generic coverage recorder
 * Contains generic utilities to capture and analyse coverage for scripting languages other than JS (done by Node).
 */

function recursiveMerge(base, more) {
  if (typeof more == "undefined" || more == null) { return; }
  Object.entries(more).forEach(entry => {
    let [key, value] = entry;

    if (Number.isFinite(value)) {
      base[key] ||= 0;
      base[key] += value;
      return
    } else if (typeof value != "object") {
      if (typeof base[key] == "undefined") { base[key] = value; }
      return
    }

    if (typeof base[key] == "undefined") { base[key] = {}; }
    recursiveMerge(base[key], value);
  });
}

export class FileCoverage {

  data = {}

  /** Expects a dict holding the properties of FileCoverage, as it would be created by `JSON.stringify()`. */
  static fromDict(dict) {
    let result = new FileCoverage();
    Object.assign(result, dict);
    return result;
  }

  getCoveredLinesData(){
    let result = [];
    Object.entries(this.data).forEach(entry => {
      let [lineNoStr, data] = entry;
      result[parseInt(lineNoStr)] = data;
    });
    return result;
  }

  addLine(number, command, functionName) {
    let lineData = this.data[number] ||= { statements: {} };
    if (functionName && !lineData.f) { lineData.f = functionName; }
    let exeCounter = lineData.statements;
    exeCounter[command] = (exeCounter[command] ||= 0) + 1;
  }

  /** Merge `more` into `base`. Deep copies sub-trees from `more`. */
  merge(other = {}) { recursiveMerge(this, other); }
}

export class CoverageRecorder {
  static FILTER_PREFIX = /^(\/dev\/fd|tmp\/|test\/).*/;
  static EXCLUDED_FILE_NAMES = ['bash', 'stdin']
  static data = {};

  static hasData() { return Object.keys(CoverageRecorder.data).length > 0; }

  static addRecord(file, lineNumber, functionName, command) {
    file ||= 'stdin';
    if (CoverageRecorder.FILTER_PREFIX.test(file)
    || CoverageRecorder.EXCLUDED_FILE_NAMES.includes(file)) {
      return;
    }
    let fileCov = CoverageRecorder.data[file] ||= new FileCoverage();
    fileCov.addLine(lineNumber, command, functionName);
  }

  static parse(recText = "") {
    try {
      let parser = new Function("r", recText);
      parser(CoverageRecorder.addRecord);
    } catch (err) {
      LOGGER.error(`^*** COVERAGE-ERROR: ${err}:\n${err.stack}\nCOV-RAW:[\n${recText}\n]`);
      failExecute("invalid coverage record encountered (see log)");
    }
  }
  static reset() { CoverageRecorder.data = {}; }

  /** Convert a regular JS dict object into a dict of FileCoverage. */
  static fromDict(dict) {
    let result = {};
    Object.entries(dict).forEach(entry => {
      let [key, value] = entry;
      result[key] = FileCoverage.fromDict(value);
    });
    return result;
  }

  /** Merge `more` into `base`. Deep copies sub-trees from `more`. */
  static merge(base, more) {
    Object.entries(more).forEach(entry => {
      let [key, value] = entry;
      let baseObj = base[key]
      if (typeof baseObj == "undefined") { base[key] = new FileCoverage(); }
      else if (!(baseObj instanceof FileCoverage)) { base[key] = FileCoverage.fromDict(baseObj); }
      base[key].merge(value);
    })
    return base;
  }
}
