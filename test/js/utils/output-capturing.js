// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

/**
 * This file contains helper utilities to capture output that happens via logger.js
 * 
 * Main API: The exported class LogCollector
 */

const { Writable } = require('node:stream');
const { openSync, closeSync, readFileSync, rm } = require('node:fs');

const logging = require('logger');
const LOGGER = logging.get();

class LogLine extends Array {
  constructor(level, ...values) {
    super(...values)
    this.level = level;
  }

  toString() { return this.join(" ") }
}

class LogCollector {
  //original settings
  #patchedLogLevels = {};
  #moduleLogger = {};
  #consoles = {}

  channelName = 'logCollector';

  linesRaw = [];
  lineStrings = []

  constructor(channel = 'logCollector') {
    this.channelName = channel;
  }

  addRawLine(...args) { this.linesRaw.push(new LogLine(...args)) }
  consoleOut(realConsole, realMethod, ...args) {
    //realMethod.call(realConsole, ...args);
    //this will produce different output for objects which are stringified from console.info/error via deep inspection
    this.lineStrings.push(args.join(' '));
  }
  reset() {
    this.linesRaw = [];
    this.lineStrings = [];
  }

  /**
   * Assign this instance to listen to the given module logger and levels.
   * Use restoreLoggerConfig to remove the extra channels again.
   * 
   * The third argument, hookConsole=true will overwrite any channel reconfiguration related to console done in code.
   * It will make a lookup in the default channel configs for the given levels and 
   * inherit/renable any output defined as stdout/stderr.
   * 
   * @returns logger corresponding to moduleName, for convenience
   */
  patchLogger(moduleName, logLevels, hookConsole = false) {
    LOGGER.info(`patch logger ${moduleName} in levels [${logLevels}] to intercept output`);
    let knownLoggers = logging.getAll();
    if (typeof knownLoggers[moduleName] == "undefined") {
      throw new Error(`No logger for module ${moduleName} in [${Object.keys(knownLoggers).join(', ')}]`)
    }

    let logger = this.#moduleLogger[moduleName] = logging.get(moduleName);
    let patched = this.#patchedLogLevels[moduleName] = {}
    let activeConsoleStreams = {}

    logLevels.forEach(level => {
      let targetConfig = logger.targets[level]
      if (typeof targetConfig == "undefined" || !targetConfig.includes(this.channelName)) {
        patched[level] = targetConfig;
        logger.targets[level] = [this.channelName, ...(logger.getEffectiveChannels(level))];
      }

      if (hookConsole) {
        let lvlConf = logger.targets[level];
        let currentLevel = [
          ...lvlConf,
          ...logging.Logger.getDefaultTargets(level)
        ]
        activeConsoleStreams.info ||= currentLevel.includes('stdout');
        if (!lvlConf.includes('stdout') && currentLevel.includes('stdout')) { lvlConf.push('stdout') }

        activeConsoleStreams.error ||= currentLevel.includes('stderr');
        if (!lvlConf.includes('stderr') && currentLevel.includes('stderr')) { lvlConf.push('stderr') }
      }

    });
    if (Object.values(activeConsoleStreams).includes(true)) {
      let currentConsole = logger.console;
      if (currentConsole != globalThis.console) { this.#consoles[moduleName] = currentConsole }

      let consoleReceiver = this;
      let consoleProxy = new Proxy(currentConsole, {
        get(target, prop, receiver) {
          if (activeConsoleStreams[prop] === true) {
            activeConsoleStreams[prop] = consoleReceiver.consoleOut.bind(
              consoleReceiver, currentConsole, target[prop]
            );
          }
          if (typeof activeConsoleStreams[prop] == "function") { return activeConsoleStreams[prop] }
          else { return target[prop] }
        }
      });

      logger.setTargetConsole(consoleProxy);
    }
    logger.setCustomWriter(this.addRawLine.bind(this), this.channelName);
    return logger;
  }

  restoreLoggerConfig(moduleNames) {
    if (typeof moduleNames == "undefined") {
      moduleNames = Object.keys(this.#moduleLogger)
    } else if (!Array.isArray(moduleNames)) {
      moduleNames = [moduleNames]
    }

    moduleNames.forEach(name => {
      let logger = this.#moduleLogger[name];
      let patch = this.#patchedLogLevels[name] || {}

      logger.setCustomWriter(null, this.channelName);
      Object.entries(patch).forEach(([level, config]) => {
        if (typeof config == "undefined") { delete logger.targets[level]; }
        else logger.targets[level] = config;
      });
      logger.setTargetConsole(this.#consoles[name]);

      delete this.#patchedLogLevels[name];
      delete this.#moduleLogger[name];
      delete this.#consoles[name];
    })
  }
}

/**
 * Just a very rudimentary OutputSream to write into a string.
 */
class ProcessOutCapture extends Writable {
  #result = ''
  #tempFile = TMP_DIR + '/process.out.' + new Date().toISOString();

  originals = []
  closed = false;

  constructor(options = {}) {
    super(Object.assign(options, {
      objectMode: true, decodeStrings: false
    }))
    this.fd = openSync(this.#tempFile, 'as')
  }
  replace(outDef) {
    if (outDef.fd == this.fd) { return }
    this.originals.push({
      stream: outDef,
      writer: outDef._write,
      fd: outDef.fd
    });
    outDef._write = this.write.bind(this)
    outDef.fd = this.fd;
  }
  _write(chunk, encoding, callback) {
    if (typeof chunk == "string") { this.#result += chunk }
    callback()
  }
  /** Ends the stream and closes everything */
  getResult() {
    if (!this.closed) {
      this.end();
      closeSync(this.fd);
      this.closed = true;
      this.originals.forEach(cfg => {
        cfg.stream._write = cfg.writer;
        cfg.stream.fd = cfg.fd;
      })
    }
    let result = {
      capturedByWrite: this.#result,
      writtenToHandle: readFileSync(this.#tempFile, { encoding: 'utf8' })
    }
    rm(this.#tempFile, ()=>true);
    return result;
  }
}

const CaptureMode = {
  OUT: "OUT",
  ERR: "ERR",
  MERGED: "MERGED",
  BOTH: "BOTH"
}

class ProcessOutput {
  static captureFor(runnable, mode = CaptureMode.MERGED) {
    let outStream = null;
    let errStream = null;

    switch (mode) {
      case CaptureMode.OUT:
        outStream = new ProcessOutCapture();
        outStream.replace(process.stdout);
        break;
      case CaptureMode.ERR:
        errStream = new ProcessOutCapture();
        errStream.replace(process.stderr);
        break;
      case CaptureMode.MERGED:
        outStream = new ProcessOutCapture();
        errStream = outStream;
        outStream.replace(process.stdout);
        outStream.replace(process.stderr);
        break;
      case CaptureMode.BOTH:
        outStream = new ProcessOutCapture();
        errStream = new ProcessOutCapture();
        outStream.replace(process.stdout);
        errStream.replace(process.stderr);
        break;
    }

    let result = {}
    try {
      result.methodReturn = runnable();
    } catch (e) {
      result.error = e;
    } finally {
      result.out = outStream != null ? outStream.getResult() : null;
      result.err = errStream != null ? errStream.getResult() : null;

      return result;
    }
  }
}

module.exports = {
  LogCollector,
  ProcessOutput
}
