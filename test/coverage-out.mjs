import { Transform } from 'node:stream';
import { relative, basename } from 'node:path';
import * as fs from 'node:fs';

const NBSP = ' ';

class Column {
  constructor(name) { this.name = name; this.max = 0; }
  updateLength(text) { this.max = Math.max(this.max, text.length) }
  valueOf() { return this.max }
}
class Line {
  #cells = []
  constructor(...cols) { this.colIdx = 0; this.cols = cols }
  cell(text, padChar, quote = true) { this.#cells.push(new Cell(this.cols[this.colIdx++], text, padChar, quote)); return this; }
  cells(...cellDefs) { cellDefs.forEach(def => this.cell(...(Array.isArray(def) ? def : [def]))); return this; }
  hr() { this.cols.forEach(c => this.cell(':', '-', false)); return this; }
  toString() { return `|${this.#cells.join('|')}|` }
}
class Cell {
  constructor(col, content = "", padChar = NBSP) {
    this.col = col;
    this.text = String(content);
    this.padding = padChar;
    col.updateLength(this.text);
  }

  toString() { return ' ' + this.text.padEnd(this.col, this.padding) + ' ' }
}

function decimalColumn(number, decimals = 2, minWidth = 6) {
  if (number == null) {
    return '  ---  '
  }
  if (!number instanceof Number) { number = Number(number) }
  return number.toFixed(decimals).padStart(minWidth, NBSP);
}

function coverageStatString(dict, type, bold = false) {
  let cur = dict[`covered${type}Count`]
  let total = dict[`total${type}Count`]
  let per = decimalColumn(dict[`covered${type}Percent`]);
  let result = `${per}% (${cur} / ${total})`;
  if (bold) { result = `**${result.trim()}**` }
  return result;
}
function coverageDataLine(cols, labelColumn, dict, bold = false) {
  let linePercentage = coverageStatString(dict, 'Line', bold);
  let branchPercentage = coverageStatString(dict, 'Branch', bold);
  let functionPercentage = coverageStatString(dict, 'Function', bold);

  return new Line(...cols).cells(labelColumn, linePercentage, branchPercentage, functionPercentage);
}

const GH_ICONS = {
  pass: ':white_check_mark:',
  fail: ':x:',
  skip: ':leftwards_arrow_with_hook:'
}
const CONSOLE_ICONS = {
  pass: '[\\e[32mPASS\\e[0m]',
  fail: '[\\e[31mFAIL\\e[0m]',
  skip: '[\\e[33mSKIP\\e[0m]'
}

class StringFormatter {
  static github(test) {
    let textLines = [...test.subTests];
    if(test.result != "pass"){
      textLines.push(
        "\n```", ...test.message, "\n```",
        '**Stack:**', "\n```", ...test.stack, "\n```",
        ...(test.diagnostics.length > 0 ? ['**Diagnostics:**', ...test.diagnostics] : []),
      )
    }
    let noBlock = textLines.length == 0;
    return [
      `<details><summary>${GH_ICONS[test.result] || ''} ${test.name}</summary>`,
      ...(noBlock ? [] : [`<blockquote>\n${textLines.join('\n')}\n</blockquote>`]),
      '</details>'
    ].join('\n');
  }
  static stdout(test) {
    let lines = []
    let result = CONSOLE_ICONS[test.result];
    let structure_char = '*';
    if(test.parent != null && test.nesting > 0){
      let siblings = test.parent.subTests;
      if(siblings.indexOf(test) == siblings.length - 1){ structure_char = '\\' }
      else { structure_char = '├' }
    }
    if(test.result != "pass"){ lines.push(...test.diagnostics, ...test.stack) }
    let tabPrefix = ''.padStart(test.nesting*2, ' ');
    let tabContent = ''.padStart((test.nesting+1)*2, ' ');
    return [
      ...(test.nesting == 0 ? [''] : []),
      `${tabPrefix}${structure_char} ${result} ${test.name}`,
      ...test.subTests,
      ...(lines.length > 0 ? [tabContent + lines.join('\n' + tabContent)] : [])
    ].join("\n");
  }
  static junit(input) {
    return {
      id: input.id,
      parentId: input.parentId,
      passed: input.result == "pass",
      name: input.name,
      message: input.message || null,
      stack: input.stack || null
    }
  }
}

class Test {
  static ROOT = false;
  subTests = [];
  diagnostics = [];
  constructor(parent, event, formatter = StringFormatter.github) {
    this.id = crypto.randomUUID();
    this.parent = parent;
    this.event = event;
    this.formatter = formatter;
  }
  addSubtest(event) {
    let newSubTest = new Test(this, event, this.formatter);
    this.subTests.push(newSubTest);
    return newSubTest;
  }
  get parentId() {
    if (this.parent == null) { return null }
    return this.parent.id;
  }
  get duration() { return this.event.details.duration_ms - this.subTestDuration }
  get subTestDuration() { return this.subTests.reduce((a, b) => a + b.duration, 0) }
  get name() { return (this.event || {name:null}).name }
  get nesting() {
    if (this.parent == null) { return -1 }
    return 1 + this.parent.nesting
  }

  get message() {
    if (this.result == "pass") { return [] }
    return [ this.event.details.error.message ]
  }

  get stack() {
    if (this.result == "pass") { return [] }
    let cause = this.event.details.error.cause || "No exception stack available";
    //could also be an arbitrary object
    if (cause instanceof Error){ return [ ...Test.#trimStrack(cause).split('\n') ] }
    else { return [ ...cause.toString().split('\n') ] }
  }

  toString() {
    if (this.parent == null) { return this.subTests.join('\n') }
    return this.formatter(this);
  }

  toJSON() {
    let parentName = this.parent == null ? null : this.parent.name;
    let result = {
      parentId: `${parentName} (${this.parentId})`,
      name: `${this.name} (${this.id})`,
      nesting: this.nesting,
      event: this.event
    }
    if (this.subTests.length > 0){ result.subTests = this.subTests.map(t=>t.toJSON.call(t)) }
    return result;
  }

  /** Removes message string from stack string */
  static #trimStrack(error){
    let stack = error.stack;
    let messageStart = stack.indexOf(error.message);
    return stack.substring(messageStart + error.message.length + 1);
  }

}
class TestRecorder {
  static VALID_TYPES = [
    'test:start',
    'test:pass', 'test:fail',
    'test:diagnostics',
    'test:stdout', 'test:stderr',
    'test:plan'
  ]
  counters = {
    pass: 0,
    fail: 0,
    skip: 0,
    time: 0,
    get total() { return this.pass + this.fail + this.skip },
    summaryTable: function(){
      let cols = [new Column('t'), new Column('p'), new Column('f'), new Column('s')];
      function line() { return new Line(...cols) }
      return [
        line().cells('**Total**', 'Passed', 'Failed', 'Skipped'),
        line().hr(),
        line().cells(
          decimalColumn(this.total, 0, 3),
          decimalColumn(this.pass, 0, 3),
          decimalColumn(this.fail, 0, 3),
          decimalColumn(this.skip, 0, 3)
        ),
        //`Total time: ${Number(this.time / 1000).toFixed(2)}s`
      ].join('\n')
    }
  }

  constructor() {
    this.outputStyle = process.env['TESTREPORTER_STYLE'] || 'github';
    this.outputStyle = StringFormatter[this.outputStyle];
    this.testDict = new Test(null, null, this.outputStyle);
    this.currentTest = this.testDict;
  }

  update(testEvent, callback) {
    switch (testEvent.eventType) {
      case 'test:start':
        if (testEvent.nesting > this.currentTest.nesting) {
          this.currentTest = this.currentTest.addSubtest(testEvent);
        } else {
          this.currentTest = this.currentTest.parent;
          return this.update(testEvent);
        }
        break;
      case 'test:diagnostics':
        this.currentTest.diagnostics.push(testEvent.message);
        break
      case 'test:fail':
      case 'test:pass':
        this.handleTestResult(testEvent);
        break;
    }
    /*
    DEBUGGING
    if (testEvent.eventType.startsWith("test:pla")){
      //process.stdout.write('\n' + testEvent.eventType + ':' + JSON.stringify(testEvent, null, 2) + "\n");
      //process.stdout.write(new Error().stack)
    }
    */
  }

  handleTestResult(event) {
    let type = event.eventType.split(':')[1];
    if (typeof event.skip != "undefined") {
      this.skip++;
      this.currentTest.result = "skip";
    } else {
      this.counters[type]++;
      this.currentTest.result = type;
    }

    this.currentTest.event = event;
    this.counters.time += this.currentTest.duration;
    this.currentTest = this.currentTest.parent;
  }
}

const testRecorder = new TestRecorder();
const customReporter = new Transform({
  writableObjectMode: true,
  transform(event, encoding, callback) {
    if (TestRecorder.VALID_TYPES.includes(event.type)) {
      try {
        event.data.eventType = event.type;
        testRecorder.update(event.data);
      } catch (e) {
        console.error("TESTEVENT-ERROR:", e, "event", event, testRecorder)
      }
    }

    if ("test:coverage" != event.type) {
      callback(null);
      return;
    }

    try {
      let lines = ['## Test Results:'];
      lines.push(testRecorder.currentTest.toString());

      lines.push(
        `\n## Test Result Summary (${Number(testRecorder.counters.time / 1000).toFixed(2)}s)`,
        testRecorder.counters.summaryTable()
      );

      let columns = [
        new Column("files"),
        new Column("line percentage"),
        new Column("branch percentage"),
        new Column("function percentage")
      ];
      function line(){ return new Line(...columns) }
      lines.push(
        '\n## Coverage Summary',
        line().cells('Files', 'Line %', 'Branch %', 'Function %'),
        line().hr()
      );

      let basePath = event.data.summary.workingDirectory;
      event.data.summary.files.forEach(fileData => {
        let name = fileData.path;
        if (globalThis.SRC_PATH && name.startsWith(globalThis.SRC_PATH)) { name = relative(globalThis.SRC_PATH, name) }
        else { name = relative(basePath, fileData.path) }
        if (name.startsWith("test/")) { return }

        lines.push(coverageDataLine(columns, name, fileData))
      })

      lines.push(line().hr());
      lines.push(coverageDataLine(columns, '**Summary**', event.data.summary.totals, true));

      let goalsFulfilled = true;
      [
        ['COVERAGE_LINE_MIN', 'coveredLinePercent'],
        ['COVERAGE_BRANCH_MIN', 'coveredBranchPercent'],
        ['COVERAGE_FUNC_MIN', 'coveredFunctionPercent']
      ].forEach(config => {
        let value = process.env[config[0]]
        if (typeof value == "string") {
          let coverageLine = `Checking: ${config[1]} must be above ${value}%`
          let actual = event.data.summary.totals[config[1]];
          if (Number(value) > actual) {
            coverageLine = `❌ ${coverageLine}\n * ${actual.toFixed(2)}% < ${value}%`
            goalsFulfilled = false
          } else {
            coverageLine = `✔ ${coverageLine}`;
          }
          lines.push('\n' + coverageLine);
        }
      });

      callback(null, lines.join('\n'));

      if (!goalsFulfilled) {
        throw '=> Coverage targets not met!'
      }
    } catch (e) {
      console.error(e)
    }
  },
});

export default customReporter;
