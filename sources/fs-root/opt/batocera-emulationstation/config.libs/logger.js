/** 
 * @file
 * This package contains generic console/file printing utilities.
 * All output must go over this module to ensure it can be configured and captured in tests correctly.
 * There should be no raw access to console anywhere else in the productive code, with very few exceptions
 * if it can absolutely not be avoided, e.g. because of dependency order issues etc.
 */

const fs = require('node:fs');
const { basename, dirname } = require('path');
const util = require('node:util');

class LogLevelEntry {
  constructor(name, level) {
    this.name = name;
    this.level = level;
  }

  [Symbol.toPrimitive](hint) { return hint == "number" ? this.valueOf() : this.toString() }
  valueOf() { return this.level }
  toString() { return this.name }
}

const Level = Object.freeze({
  USER: new LogLevelEntry("USER", 99),
  API: new LogLevelEntry("API", 100),
  ERROR: new LogLevelEntry("ERROR", 0),
  WARN: new LogLevelEntry("WARN", 1),
  INFO: new LogLevelEntry("INFO", 2),
  DEBUG: new LogLevelEntry("DEBUG", 3),
  TRACE: new LogLevelEntry("TRACE", 4),
})

/**
 * Handles everything related to logging and output on console. Wherever possible, output should be produced by using
 * one of the methods defined on `Logger`. This allows to uniformly control it and also capture it in tests.
 */
class Logger {
  static #INITIALISED = false;
  static #FILEWRITER = null;
  static #FILESTREAM = null;
  static #LOGGERS = {};

  static #DEFAULT_TARGETS = {
    [Level.USER]: ['stderr'],
    [Level.API]: ['stdout'],
    [Level.ERROR]: ['stderr', 'file'],
    [Level.WARN]: ['stderr', 'file'],
    [Level.INFO]: ['file'],
    [Level.DEBUG]: ['file'],
    [Level.TRACE]: ['file']
  }
  static getDefaultTargets(level) { return [...(Logger.#DEFAULT_TARGETS[level] || [])] }

  static #GLOBAL_CHANNELS = Logger.#DEFAULT_TARGETS;
  static #GLOBAL_MAX_LEVEL = Level.WARN;

  /**
   * Change the default logging configuration for all module loggers that don't give more specific configuration during creation.
   * 
   * @param {Level|string} maxLevel - max log level to write.
   * @param {object|string} [channelTargets] - "default" to reset or a dict of {Level.Name: [channels...]}.
   * @param {boolean} [merge=false] - for channelTargets={object}. Merge with current (true), Replace current (false).
   *
   * @see Logger.#writers for details on channels
   */
  static configureGlobal(maxLevel = null, channelTargets = null, merge = false) {
    if (Level[maxLevel]) { Logger.#GLOBAL_MAX_LEVEL = maxLevel }
    else { Logger.#GLOBAL_MAX_LEVEL = Level.WARN }

    if(channelTargets == "default"){ Logger.#GLOBAL_CHANNELS = Logger.#DEFAULT_TARGETS }
    else if (channelTargets != null && typeof channelTargets === "object") { 
      if(merge){ Object.assign(Logger.#GLOBAL_CHANNELS, channelTargets) } 
      else { Logger.#GLOBAL_CHANNELS = Object.assign({}, channelTargets) }
    }
  }

  static getAll() { return Object.assign({}, this.#LOGGERS) }

  static enableLogfile(path = null) {
    Logger.close();
    try {
      if (path == null) {
        Logger.#FILEWRITER = console;
      } else {
        let parentDir = dirname(path);
        if (!fs.existsSync(parentDir)) { fs.mkdirSync(parentDir, { recursive: true }) }

        Logger.#FILESTREAM = fs.createWriteStream(path, { flags: 'a' });
        Logger.#FILEWRITER = new console.Console(Logger.#FILESTREAM);
        Logger.#FILEWRITER.error(`\n********** ${new Date().toISOString()} btc-config **********\n`);
      }
    } catch (error) {
      process.stderr.write(`Could not open file ${path} for writing.\n`);
      Logger.#FILEWRITER = console;
    }
  }

  /**
   * @return {Logger} logger instance
   */
  static for(moduleName = null, maxLevel = null, channelConfig = null) {
    if (!this.#INITIALISED) {
      this.#INITIALISED = true;
      let logArgIdx = process.argv.findIndex(value => value.startsWith("--log-level="));
      if (logArgIdx > 0) {
        let setting = process.argv[logArgIdx].split("=");
        process.argv.splice(logArgIdx, 1);
        let newMax = Level[(setting[1] || "WARN").toUpperCase()];
        if (newMax instanceof LogLevelEntry) { maxLevel = newMax }
        this.#GLOBAL_MAX_LEVEL = newMax;
      }
    }
    if (moduleName == null) {
      moduleName ||= basename(getFirstCallingFrame().scriptName);
    }
    return this.#LOGGERS[moduleName] ||= new Logger(moduleName, maxLevel, channelConfig);
  }

  static write(logLevel, message, ...data) {
    let logger = Logger.for(null);
    logger.#mapToOutput(logLevel, message, ...data);
  }

  static close() {
    if (Logger.#FILEWRITER != null && Logger.#FILEWRITER != console) {
      try { Logger.#FILESTREAM.close(); }
      catch (error) { console.error(error); }
    }
  }

  #writers = {
    stderr: this.#consoleErr,
    stdout: this.#consoleOut,
    file: this.#writeToFile,
  }

  #maxLevel = null;
  #console = null;

  constructor(modName, maxLevel = null, channelTargets = {}) {
    this.module = modName;
    this.#maxLevel = maxLevel;

    if (this.maxLevel > Level.WARN && Logger.#FILEWRITER == null) {
      this.#consoleErr(Level.INFO, "Loglevel set to more than WARN, but no log file given. Write to console.")
      Logger.enableLogfile();
    }

    this.targets = channelTargets || {};
    this.debug(`Initializing logger for ${this.module}`);
  }

  get maxLevel() { return this.#maxLevel || Logger.#GLOBAL_MAX_LEVEL }
  get console() { return this.#console || console }

  /** force output on stderr to print message not obstructing api output, visible to the user only */
  userOnly(...data) { this.#mapToOutput(Level.USER, ...data); }

  /** Force string to output on console stdout */
  apiOut(...data) { this.#mapToOutput(Level.API, data.join('\n')); }

  info(...data) { this.#mapToOutput(Level.INFO, ...data); }

  warn(...data) { this.#mapToOutput(Level.WARN, ...data); }

  error(...data) { this.#mapToOutput(Level.ERROR, ...data); }

  debug(...data) { this.#mapToOutput(Level.DEBUG, ...data); }

  trace(...data) { this.#mapToOutput(Level.TRACE, ...data); }

  setCustomWriter(handler = null, channelName = "custom") {
    if (handler == null) {
      delete this.#writers[channelName];
    } else if (typeof channelName == "string") {
      this.#writers[channelName] = handler;
    }
  }

  /** Allows to overwrite the Console instance used for stdout and stderr */
  setTargetConsole(cnsl) { this.#console = cnsl }

  getEffectiveChannels(level) { return this.targets[level] || Logger.#GLOBAL_CHANNELS[level] || [] }

  #mapToOutput(level, message, ...rest) {
    if (typeof Level[level] == "undefined") {
      this.#mapToOutput(Level.INFO, level, message, ...rest);
      return;
    }
    let outputs = this.getEffectiveChannels(level);
    if (Logger.#FILEWRITER == console && outputs.length > 1) {
      outputs = outputs.filter(entry => entry != this.#writeToFile);
    }
    for (let target of outputs) { this.#writers[target].call(this, level, message, ...rest); }
  }

  #consoleOut(level, message, ...rest) { this.console.info(message, ...rest); }

  #consoleErr(level, message, ...rest) {
    let prefix = level == Level.ERROR ? 'ERROR: ' : '';
    this.console.error(prefix + message, ...rest);
  }

  #writeToFile(level, message, ...data) {
    if (Logger.#FILEWRITER == null) { return }
    if (level > this.maxLevel) { return }

    let lineNumber = getFirstCallingFrame().lineNumber;
    let time = new Date().toISOString();
    level = level.toString().padStart(5);
    let prefix = `${time} [${level}:${this.module}(${lineNumber})] `;
    Logger.#FILEWRITER.log(prefix + message, ...data);
  }
}

function getFirstCallingFrame() {
  const UNKNOWN_SITE = {
    scriptName: "unknown-source",
    lineNumber: 0
  };
  let callSites = util.getCallSites || getCallSitesByStack;
  return callSites().filter(frame => frame.scriptName != __filename && frame.scriptName.startsWith('/'))[0] || UNKNOWN_SITE;
}

function getCallSitesByStack() {
  let stack = new Error().stack.split('\n');
  const frameParser = /\s*at.*?((node:|\/)[\S /\.]+):(\d+):\d+/;
  let siteList = stack
    .filter(_ => frameParser.test(_))
    .map(_ => {
      let parsed = frameParser.exec(_);
      return {
        scriptName: parsed[1],
        lineNumber: Number(parsed[3])
      }
    });
  return siteList;
}

module.exports = {
  /**Logger class for repeated usage */
  Logger,

  /** Level for usage with static shorthand method 'write' */
  Level,

  /** Shorthand convenience method to use were full Logger instance is not needed. */
  write: Logger.write,

  /** 
   * Fast way to get a logger instance
   * @type {function}
   * @returns {Logger} logger instance
  */
  get: Logger.for.bind(Logger),

  /** mainly for testing purposes */
  getAll: Logger.getAll.bind(Logger)
}
