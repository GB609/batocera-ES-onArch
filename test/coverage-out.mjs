import { Transform } from 'node:stream';
import { relative } from 'node:path'

const NBSP = ' '

class Column {
  constructor(name){  this.name = name; this.max = 0; }
  updateLength(text){ this.max = Math.max(this.max, text.length) }
  valueOf(){ return this.max }
}
class Line {
  #cells = []
  constructor(...cols){ this.colIdx = 0; this.cols = cols }
  cell(text, padChar, quote=true){ this.#cells.push(new Cell(this.cols[this.colIdx++], text, padChar, quote)); return this; }
  cells(...cellDefs) { cellDefs.forEach(def => this.cell(...(Array.isArray(def) ? def : [def] ))); return this; }
  hr(){ this.cols.forEach(c => this.cell(':', '-', false)); return this; }
  toString(){ return `|${this.#cells.join('|')}|` }
}
class Cell {
  constructor(col, content = "", padChar = NBSP){
    this.col = col;
    this.text = String(content);
    this.padding = padChar;
    col.updateLength(this.text);
  }

  toString(){ return ' ' + this.text.padEnd(this.col, this.padding) + ' ' }
}

function decimalColumn(number){
  if(number == null){
    return '  ---  '
  }
  return number.toFixed(2).padStart(6, NBSP);
}

function coverageStatString(dict, type, bold = false){
  let cur = dict[`covered${type}Count`]
  let total = dict[`total${type}Count`]
  let per = decimalColumn(dict[`covered${type}Percent`]);
  let result = `${per}% (${cur} / ${total})`;
  if(bold) { result = `**${result.trim()}**` }
  return result;
}
function coverageDataLine(cols, labelColumn, dict, bold = false){
  let linePercentage = coverageStatString(dict, 'Line', bold)
  let branchPercentage = coverageStatString(dict, 'Branch', bold)
  
  return new Line(...cols).cells(labelColumn, linePercentage, branchPercentage);
}

const customReporter = new Transform({
  writableObjectMode: true,
  transform(event, encoding, callback) {
    if(["test:coverage"].indexOf(event.type) < 0) {
      callback(null);
      return
    }

    try{
      let columns = [
        new Column("files"),
        new Column("line percentage"),
        new Column("branch percentage")
      ];
      function line(){ return new Line(...columns) }
      let lines = [
        line().cells('Files', 'Line %', 'Branch %'),
        line().hr()
      ];
      let basePath = event.data.summary.workingDirectory;
      event.data.summary.files.forEach(fileData => {
        let name = fileData.path;
        if(globalThis.SRC_PATH && name.startsWith(globalThis.SRC_PATH)){ name = relative(globalThis.SRC_PATH, name) }
        else { name = relative(basePath, fileData.path) }
        if(name.startsWith("test/")) { return }
        
        lines.push(coverageDataLine(columns, name, fileData))
      })
  
      lines.push(coverageDataLine(columns, '**Summary**', event.data.summary.totals, true));
      
      let goalsFulfilled = true;
      [
        ['COVERAGE_LINE_MIN', 'coveredLinePercent'], 
        ['COVERAGE_BRANCH_MIN', 'coveredBranchPercent']
      ].forEach(config => {
        let value = process.env[config[0]]
        if(typeof value == "string"){
          let coverageLine = `Checking: ${config[1]} must be above ${value}%`
          let actual = event.data.summary.totals[config[1]];
          if(Number(value) > actual){
            coverageLine = `❌ ${coverageLine}\n * ${actual.toFixed(2)}% < ${value}%`
            goalsFulfilled = false
          } else {
            coverageLine = `✔ ${coverageLine}`;
          }
          lines.push('\n' + coverageLine + '\n');
        }
      });

      callback(null, lines.join('\n'));

      if(!goalsFulfilled){
        throw '=> Coverage targets not met!'
      }
    } catch (e){
      console.error(e)
    }
  },
});

export default customReporter;
