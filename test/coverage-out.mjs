import { Transform } from 'node:stream';
import { relative } from 'node:path'

const NBSP = ' '

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

function decimalColumn(number) {
  if (number == null) {
    return '  ---  '
  }
  return number.toFixed(2).padStart(6, NBSP);
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
  let linePercentage = coverageStatString(dict, 'Line', bold)
  let branchPercentage = coverageStatString(dict, 'Branch', bold)

  return new Line(...cols).cells(labelColumn, linePercentage, branchPercentage);
}

const GH_ICONS = {
  pass: ':white_check_mark:',
  fail: ':x:',
  skip: ':leftwards_arrow_with_hook:'
}
class StringFormatter {
  static github(test) {
    let textLines = [...test.subTests, ...test.message, ...test.diagnostics, ...test.stack];
    let noBlock = textLines.length == 0;
    return [
      `<details><summary>${GH_ICONS[test.result] || ''} ${test.name}</summary>`,
      ...(noBlock ? [] : [`<blockquote>\n${textLines.join('\n')}\n</blockquote>`]),
      '</details>'
    ].join('\n');
  }
  static stdout(input) {
    return [
      `${'*'.padLeft(input.nesting, ' ')} ${input.title}`
    ];
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
  get name() { return this.event.name }
  get nesting() {
    if (this.parent == null) { return -1 }
    return 1 + this.parent.nesting
  }
  get message() {
    if (this.result == "pass") { return [] }

    return [
      "\n```",
      this.event.details.error.message,
      "```"
    ]
  }

  get stack() {
    if (this.result == "pass") { return [] }
    return ['STCK TBD'];
  }

  toString() {
    if (this.parent == null) { return this.subTests.join('\n') }
    return this.formatter(this);
  }

  toJSON() {
    if (this.parent == null) { return this.subTests }
    return this.formatter(this);
  }

}
class TestRecorder {
  static VALID_TYPES = ["test:start", "test:pass", "test:fail", "test:diagnostics"]
  counters = {
    pass: 0,
    fail: 0,
    skip: 0,
    time: 0,
    get total() { return this.passed + this.failed + this.skipped }
  }

  constructor() {
    this.outputStyle = process.env['TESTREPORTER_STYLE'] || 'github';
    this.testDict = new Test(null, null,);
    this.currentTest = this.testDict;
  }

  update(testEvent) {
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
      let columns = [
        new Column("files"),
        new Column("line percentage"),
        new Column("branch percentage")
      ];
      function line() { return new Line(...columns) }
      let lines = [
        line().cells('Files', 'Line %', 'Branch %'),
        line().hr()
      ];
      let basePath = event.data.summary.workingDirectory;
      event.data.summary.files.forEach(fileData => {
        let name = fileData.path;
        if (globalThis.SRC_PATH && name.startsWith(globalThis.SRC_PATH)) { name = relative(globalThis.SRC_PATH, name) }
        else { name = relative(basePath, fileData.path) }
        if (name.startsWith("test/")) { return }

        lines.push(coverageDataLine(columns, name, fileData))
      })

      lines.push(coverageDataLine(columns, '**Summary**', event.data.summary.totals, true));

      let goalsFulfilled = true;
      [
        ['COVERAGE_LINE_MIN', 'coveredLinePercent'],
        ['COVERAGE_BRANCH_MIN', 'coveredBranchPercent']
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
          lines.push('\n' + coverageLine + '\n');
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
