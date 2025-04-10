const fs = require('node:fs');

class LogLevelEntry {
  constructor(name, level) {
    this.name = name;
    this.level = level;
  }

  valueOf() { return this.level; }
  toString() { return this.name; }
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
  static #FILEWRITER = null;
  static #FILESTREAM = null;
  static #LOGGERS = {};

  static getAll() { return Object.assign({}, this.#LOGGERS) }

  static enableLogfile(path = null) {
    Logger.close();
    try {
      if (path == null) {
        Logger.#FILEWRITER = console;
      } else {
        Logger.#FILESTREAM = fs.createWriteStream(path, { flags: 'a' });
        Logger.#FILEWRITER = new console.Console(Logger.#FILESTREAM);
        Logger.#FILEWRITER.error(`\n********** ${new Date().toISOString} btc-config **********\n`);
      }
    } catch (error) {
      console.error(`Could not open file ${path} for writing.`);
      Logger.#FILEWRITER = console;
    }
  }

  static for(moduleName = null, maxLevel = Level.WARN) {
    if (moduleName == null) {
      moduleName = require('path').basename(__filename)
    }
    return this.#LOGGERS[moduleName] ||= new Logger(moduleName, maxLevel);
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

  constructor(modName, maxLevel) {
    this.module = modName;
    this.maxLevel = maxLevel;

    if (maxLevel > Level.WARN && Logger.#FILEWRITER == null) {
      this.#consoleErr(Level.INFO, "Loglevel set to more than WARN, but no log file given. Write to console.")
      Logger.enableLogfile()
    }

    this.targets = {
      [Level.USER]: ['stderr'],
      [Level.API]: ['stdout'],
      [Level.ERROR]: ['stderr', 'file'],
      [Level.WARN]: ['stderr', 'file'],
      [Level.INFO]: ['file'],
      [Level.DEBUG]: ['file'],
      [Level.TRACE]: ['file']
    }
    this.debug(`Initializing logger for ${this.module}`);
  }

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
    let outputs = this.targets[level];
    if (Logger.#FILEWRITER == console && outputs.length > 1) {
      outputs = outputs.filter(entry => entry != this.#writeToFile);
    }
    for (let target of outputs) { this.#writers[target](level, message, ...rest); }
  }

  #consoleOut(level, message, ...rest) { console.info(message, ...rest); }

  #consoleErr(level, message, ...rest) {
    let prefix = level == Level.ERROR ? 'ERROR: ' : '';
    console.error(prefix + message, ...rest);
  }

  #writeToFile(level, message, ...data) {
    if (Logger.#FILEWRITER == null) { return }
    if (level > this.maxLevel) { return }

    let time = new Date().toISOString();
    level = level.toString().padStart(5);
    let prefix = `${time} [${level}:${this.module}] `;
    Logger.#FILEWRITER.log(prefix + message, ...data);
  }
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
