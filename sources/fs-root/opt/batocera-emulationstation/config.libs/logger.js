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

  static #GLOBAL_CHANNELS = Logger.#DEFAULT_TARGETS;
  static #GLOBAL_MAX_LEVEL = Level.WARN;

  static configureGlobal(maxLevel = null, channelTargets = null){
    if (Level[maxLevel]) { Logger.#GLOBAL_MAX_LEVEL = maxLevel }
    else { LOGGER.#GLOBAL_MAX_LEVEL = Level.WARN }

    if (typeof channelTargets === "object") { Logger.#GLOBAL_CHANNELS = Object.assign({}, channelTargets) }
    else { LOGGER.#GLOBAL_CHANNELS = Logger.#DEFAULT_TARGETS }
  }

  static getAll() { return Object.assign({}, this.#LOGGERS) }

  static enableLogfile(path = null) {
    Logger.close();
    //process.stdout.write("ENABLE LOG:" +  path + '\n');
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
    file: this.#writeToFile
  }

  #maxLevel = null;

  constructor(modName, maxLevel = null, channelTargets = {}) {
    this.module = modName;
    this.#maxLevel = maxLevel;

    if (this.maxLevel > Level.WARN && Logger.#FILEWRITER == null) {
      this.#consoleErr(Level.INFO, "Loglevel set to more than WARN, but no log file given. Write to console.")
      Logger.enableLogfile();
    }

    this.targets =  channelTargets || {};
    /*process.stderr.write("REQUESTING NEW LOGGER FOR: " + modName + '\n')
    process.stderr.write("LOCAL CONFIG IS: " + JSON.stringify(this.targets) + '\n')
    process.stderr.write("GLOBAL CONFIG IS: " + JSON.stringify(Logger.#GLOBAL_CHANNELS) + '\n')*/
    this.debug(`Initializing logger for ${this.module}`);
  }

  get maxLevel(){ return this.#maxLevel || Logger.#GLOBAL_MAX_LEVEL }

  /** force output on stderr to print message not obstructing api output, visible to the user only */
  userOnly(...data) { this.#mapToOutput(Level.USER, ...data); }

  /** Force string to output on console stdout */
  apiOut(...data) { this.#mapToOutput(Level.API, data.join('\n')); }

  info(...data) { this.#mapToOutput(Level.INFO, ...data); }

  warn(...data) { this.#mapToOutput(Level.WARN, ...data); }

  error(...data) { this.#mapToOutput(Level.ERROR, ...data); }

  debug(...data) { this.#mapToOutput(Level.DEBUG, ...data); }

  trace(...data) { this.#mapToOutput(Level.TRACE, ...data); }

  #mapToOutput(level, message, ...rest) {
    if (typeof Level[level] == "undefined") {
      this.#mapToOutput(Level.INFO, level, message, ...rest);
      return;
    }
    let outputs = this.targets[level] || Logger.#GLOBAL_CHANNELS[level] || [];
    if (Logger.#FILEWRITER == console && outputs.length > 1) {
      outputs = outputs.filter(entry => entry != this.#writeToFile);
    }
    for (let target of outputs) { this.#writers[target].call(this, level, message, ...rest); }
  }

  #consoleOut(level, message, ...rest) { console.info(message, ...rest); }

  #consoleErr(level, message, ...rest) {
    let prefix = level == Level.ERROR ? 'ERROR: ' : '';
    console.error(prefix + message, ...rest);
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
  if (typeof util.getCallSites != "function") { return UNKNOWN_SITE; }
  return util.getCallSites().filter(frame => frame.scriptName != __filename)[0] || UNKNOWN_SITE;
}

module.exports = {
  /**Logger class for repeated usage */
  Logger,

  /** Level for usage with static shorthand method 'write' */
  Level,

  /** Shorthand convenience method to use were full Logger instance is not needed. */
  write: Logger.write,

  /** Fast way to get a logger instance */
  get: Logger.for.bind(Logger),

  /** mainly for testing purposes */
  getAll: Logger.getAll.bind(Logger)
}
