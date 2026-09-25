import fs from 'node:fs';

import { FileCoverage } from './coverage-recording.mjs';

function reg(flags, ...exp) {
  if (flags instanceof RegExp) {
    flags = '';
    exp.unshift(flags);
  }
  let result = new RegExp(exp.map(r => r.source || r).join(''), flags || '');
  return result;
}

let REG_ARBITRARY_BEGIN = /(?:^(?:[ \t]*|(?:[^\n]*[ \t&|;])))/;
let LINE_CONT = /(?: |\t|\\\n)/;
let FUNC_OPEN_BRACE = /(?<OPENER>\((?!\))|\{)/

let FUNCTION_BY_KEYWORD = reg('gm', REG_ARBITRARY_BEGIN, '(function', LINE_CONT, '+(\\S+))\\s+', FUNC_OPEN_BRACE);
let FUNCTION_BY_BRACES = reg('gm', REG_ARBITRARY_BEGIN, '((\\S+)', LINE_CONT, '*', /(?<!=)\(\)/, ')', /\s*/, FUNC_OPEN_BRACE);

let NO_COMMENT_PREFIX_SAME_LINE = /(?<!(?:^| )#[^\n]*)/;
let UNMASKED = /(?<=(?:\\\\)+|[^\\])/;
let ALL_QUOTES = reg('gms', NO_COMMENT_PREFIX_SAME_LINE, UNMASKED, "(?<q>[\"'])(.*?)", UNMASKED, "\\k<q>")

function stripQuoteContent(fullMatchStr, qChar, content) {
  return `${qChar}${content.replaceAll(/([^\n\\]|\\(?!\n))/g, '%')}${qChar}`;
}

function sanitizeText(sourceText) {
  let blanked = sourceText.replaceAll(/(?<=^)[ \t]*#.*$/gm, '')
  //FIXME: blank out quoted heredocs
  //FIXME: blank out parts outside of $() or ${} in unquoted heredocs
  blanked = blanked.replaceAll(ALL_QUOTES, stripQuoteContent);
  blanked = blanked.replaceAll(/[ \t]#.*$/gm, '')
  return blanked;
}

function indexSourceLines(shellFile, indexedSourceText, indexedWithoutComments) {
  let byNumber = shellFile.linesByNumber;
  let byIndex = shellFile.linesByStartIndex;
  let locNbr = 0;
  // indexedWithoutComments is 'sanitized' - quotes replaced with filler chars and comments removed
  // good for function detection with almost no false positives, but bad for reporting real source
  // Aside from its use in function matching, the sanitized lines are used to determine if a line
  // contains code at all (contributes to LOC)
  let continuedLine = null;
  Object.entries(indexedWithoutComments.byNumber).forEach(entry => {
    let [lineNumber, noCommentSource] = entry;
    noCommentSource = noCommentSource.source.trim()
    let realSource = indexedSourceText.byNumber[lineNumber].source;
    let isCode = noCommentSource.length > 0
    let lineData = {
      number: lineNumber,
      isCode: isCode,
      source: realSource,
      get effectiveSource() {
        let lines = [];
        for (let current = this; current != null; current = current.next) {
          lines.push(current.source);
        }
        if (lines.length > 1) {
          lines = [lines.map(l => l.replace(/\\.*?$/, '').trim()).join(" ")];
        }
        return lines[0].trim();
      },
      addExecutions: function addExecutions(numExec) {
        for (let current = this; current != null; current = current.next) {
          current.execs ||= 0;
          current.execs += numExec
        }
      }
    }
    if (isCode) {
      locNbr++;
      if (continuedLine != null) continuedLine.next = lineData;
      if (noCommentSource.endsWith('\\')) { continuedLine = lineData; }
      else { continuedLine = null; }
    }
    byNumber[lineNumber] = lineData;
    byIndex[indexedSourceText.byNumber[lineNumber].index] = lineData;
  })
  shellFile.loc = locNbr;
}

function findBalancedBlock(source, startIndex, openMatcher, closeMatcher) {
  let blockStart = startIndex;

  let isBalanced = (match) => {
    // set blockStart for next iteration before closeMatcher is wiped
    blockStart = match.index + match[0].length;

    let range = source.substring(startIndex, blockStart);

    openMatcher.lastIndex = 0;
    let allStarts = [...range.matchAll(openMatcher)];

    closeMatcher.lastIndex = 0;
    let allEnds = [...range.matchAll(closeMatcher)];

    return match.balanced = (allStarts.length == allEnds.length);
  }

  let match = null;
  do {
    closeMatcher.lastIndex = blockStart;
    match = closeMatcher.exec(source);
  } while (match != null && !isBalanced(match))

  if (match == null || !match.balanced) { return null; }

  let result = source.substring(startIndex, blockStart);
  return result;
}

export class LineIndexedText extends String {
  byNumber = {};
  byIndex = {};
  raw = "";
  constructor(rawText) {
    super(rawText);
    let curNumber = 0;
    this.raw = rawText;
    rawText.matchAll(/^(.*)$/gm).forEach(t => {
      let lineNumber = ++curNumber;
      let lineData = {
        number: lineNumber,
        index: t.index,
        source: t[1]
      }
      this.byNumber[lineNumber] = lineData;
      this.byIndex[t.index] = lineData;
    });
  }
  valueOf() { return this.raw; }
  toString() { return this.valueOf(); }
}

const FUNC_OPEN_CHAR_STYLES = Object.freeze({
  '{': 'CURLY',
  '(': 'ROUND'
});
export class ShellFunction {
  name = "";
  rawName = "";
  line = null;
  funcStart = 0;
  body = null;
  constructor(name, rawName, line) {
    this.name = name;
    this.rawName = rawName;
    this.line = line;
    this.funcStart = line.index + line.source.indexOf(rawName);
  }

  get key() { return `${this.lineno}:${this.name}`; }
  get lineno() { return this.line.number; }
  get bodyDelimExpressions() {
    return this.body.style == 'ROUND'
      ? [/\(/g, /(?<=[;\n][ \t]*)\)/g]
      : [/\{/g, /(?<=[;\n][ \t]*)\}/g];
  }

  defineBodyOpen(style, line, openTagIndex) {
    this.body = {
      style: FUNC_OPEN_CHAR_STYLES[style] || style,
      startLine: line,
      openTagIndex: openTagIndex
    };
  }

  setBody(text, lastLine, closeTagIndex) {
    Object.assign(this.body, {
      source: text,
      endLine: lastLine,
      closeTagIndex: closeTagIndex
    });
  }

  compareTo(other) {
    return this.lineno != other.lineno ? this.lineno - other.lineno : this.name.localeCompare(other.name);
  }

  toString() {
    return `${this.line.number}:${this.name} ${this.body.startLine.number}-${this.body.endLine.number}`;
  }
}

export class AnalyzedShellFile {
  #coverage_stats = null;
  #functions = {}
  linesByNumber = {}
  linesByStartIndex = {}

  loc = 0
  funcCount = 0

  constructor(path, realSource, sanitizedText) {
    this.file = path;
    this.realSource = realSource;
    this.cleanedSource = sanitizedText;
  }

  /** Return a dictionary of all functions, ordered by linenumber, then name */
  get functions() {
    let functions = Object.values(this.#functions);
    functions.sort((first, second) => first.compareTo(second));
    return functions.reduce((cont, func) => { return cont[func.key] = func, cont; }, {})
  }

  addFunctions(...shellFuncs) {
    shellFuncs.forEach(func => { this.#functions[func.key] ||= func; });
    this.funcCount = Object.values(this.#functions).length;
  }

  lineByNumber(number) { return this.realSource.byNumber[number] || null; }
  lineByCleanedIndex(lineStartIndex) {
    let line = this.cleanedSource.byIndex[lineStartIndex];
    if (!line) {
      // index is something in the middle, no line start
      let lastFoundLineBegin;
      for (let idx of Object.keys(this.cleanedSource.byIndex)) {
        if (idx <= lineStartIndex) lastFoundLineBegin = idx;
        break;
      }
      line = this.cleanedSource.byIndex[lastFoundLineBegin];
    }
    return line ? this.realSource.byNumber[line.number] : null;
  }

  indexFunctionsToLines() {
    Object.values(this.linesByNumber).forEach(line => delete line.function);
    Object.values(this.#functions).forEach(f => {
      for (let curLine = f.line.number; curLine <= f.body.endLine.number; curLine++) {
        this.linesByNumber[curLine].function = f;
      }
    });
  }

  applyCoverageRecord(fileCoverage) {
    this.indexFunctionsToLines();
    this.#coverage_stats = null;

    let coveredLines = fileCoverage.getCoveredLinesData();
    for (let lineno in coveredLines) {
      let logPrefix = `COV:[${this.file}:${lineno}]:`
      let analysedLine = this.linesByNumber[lineno];
      let line = coveredLines[lineno];
      if (line.f) {
        if (!analysedLine.function) { /*console.warn(`${logPrefix}function expected, but not found during analysis`);*/ }
        else {
          let func = analysedLine.function
          if (line.f == func.name) { func.executed = true; }
        }
      }
      if (!analysedLine.isCode && Object.values(line.statements).length > 0) {
        //console.warn(`${logPrefix}was detected as comment, but got a statements record: \n` + JSON.stringify(line.statements));
        continue;
      }
      Object.entries(line.statements || {}).forEach(entry => {
        let [statement, numExec] = entry;
        if (analysedLine.effectiveSource.includes(statement)) {
          analysedLine.addExecutions(numExec);
        }
      })
    }
  }

  /** After coverage records were applied */
  getStatistics() {
    //replicate the event structure of file entries for the 'coverage:summary' event from node
    return this.#coverage_stats ||= {
      coveredLineCount: Object.values(this.linesByNumber).reduce((sum, l) => {
        return sum + (l.execs ? 1 : 0);
      }, 0),
      totalLineCount: this.loc,
      get coveredLinePercent() { return this.coveredLineCount / this.totalLineCount * 100 },

      coveredBranchCount: 0,
      totalBranchCount: 0,
      get coveredBranchPercent() { return this.coveredBranchCount / this.totalBranchCount * 100 },

      coveredFunctionCount: Object.values(this.#functions).reduce((sum, f) => {
        return sum + (f.executed ? 1 : 0);
      }, 0),
      totalFunctionCount: this.funcCount,
      get coveredFunctionPercent() { return this.coveredFunctionCount / this.totalFunctionCount * 100 },
    }
  }
}

function matchToFunction(shellFile, match) {
  let unmaskedLine = shellFile.lineByCleanedIndex(match.index);
  let cleanedOpener = shellFile.cleanedSource.byIndex[match.index];
  let openerEndPos = calculateMultilineRealEnd(shellFile, cleanedOpener, match[0]);

  let func = new ShellFunction(match[2], match[1], unmaskedLine);
  func.defineBodyOpen(
    match.groups.OPENER,  // see FUNC_OPEN_BRACE
    openerEndPos.line, openerEndPos.idx
  );

  // find the full body in cleaned text
  // then get the line number and index of the terminating char in cleaned text
  // get length of string up to terminator in cleaned text and use to calculate end index
  // in real text by doing realLine.index + closeLine
  let rawOpenerIndex = match.index + match[0].length - 1;
  let cleanedBodyText = findBalancedBlock(match.input, rawOpenerIndex, ...func.bodyDelimExpressions);
  if (cleanedBodyText == null) { return null; }

  cleanedOpener = shellFile.cleanedSource.byNumber[func.body.startLine.number];
  let realEnd = calculateMultilineRealEnd(shellFile, cleanedOpener, cleanedBodyText);
  let realBodyText = shellFile.realSource.substring(func.body.openTagIndex + 1, realEnd.idx)
  func.setBody(realBodyText, realEnd.line, realEnd.idx);

  return func;
}

function calculateMultilineRealEnd(shellFile, cleanedStartLine, cleanedMlString) {
  let mlLineArray = cleanedMlString.split('\n');
  let endlineNumber = cleanedStartLine.number + mlLineArray.length - 1;

  let realStartLine = shellFile.lineByNumber(cleanedStartLine.number);
  let realEndLine = shellFile.lineByNumber(endlineNumber);
  let lastCleanedLine = mlLineArray.pop();

  let cleanedOffset = shellFile.cleanedSource.indexOf(cleanedMlString, cleanedStartLine.index)
    - cleanedStartLine.index
    + cleanedMlString.length - 1;
  let realEndIndex = realStartLine == realEndLine
    ? realStartLine.index + cleanedOffset
    : realEndLine.index + lastCleanedLine.length - 1;
  return { line: realEndLine, idx: realEndIndex };
}

export function analyseShellFile(filePath) {
  if (!fs.existsSync(filePath)) { return { file: filePath, data: null }; }

  let text = new LineIndexedText(fs.readFileSync(filePath, { encoding: 'utf8' }));
  // replace all contents of with blanks to avoid false-positive functions detected inside of variables etc
  let quoteBlankedText = new LineIndexedText(sanitizeText(text.raw));

  let result = new AnalyzedShellFile(filePath, text, quoteBlankedText);
  indexSourceLines(result, text, quoteBlankedText);

  let functionFactory = matchToFunction.bind(null, result);
  //console.log("running function matcher agains:\n", quoteBlankedText)
  result.addFunctions(...quoteBlankedText.raw.matchAll(FUNCTION_BY_KEYWORD).map(functionFactory).filter(f => f != null));
  result.addFunctions(...quoteBlankedText.raw.matchAll(FUNCTION_BY_BRACES).map(functionFactory).filter(f => f != null));

  return result;
}
