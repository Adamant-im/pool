import config from './config/reader.js';
import utils from './utils.js';

import fs from 'fs';

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

const infoStr = fs.createWriteStream(`./logs/${date()}.log`, {
  flags: 'a',
});

const LOG_LEVELS = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  log: 4,
  debug: 5,
};

const LOG_COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[32m',
  log: '\x1b[34m',
  debug: '\x1b[36m',
};

export default {
  /**
   * Writes the pool start marker into the current log file.
   * @returns {void}
   */
  start() {
    infoStr.write(`\n\n[The pool started] _________________${fullTime()}_________________\n`);
  },
  /**
   * Logs an error message.
   * @param {string} str Message to log
   * @returns {void}
   */
  error(str) {
    writeLog('error', str);
  },
  /**
   * Logs a warning message.
   * @param {string} str Message to log
   * @returns {void}
   */
  warn(str) {
    writeLog('warn', str);
  },
  /**
   * Logs an informational message.
   * @param {string} str Message to log
   * @returns {void}
   */
  info(str) {
    writeLog('info', str);
  },
  /**
   * Logs a verbose operational message.
   * @param {string} str Message to log
   * @returns {void}
   */
  log(str) {
    writeLog('log', str);
  },
  /**
   * Logs detailed diagnostics for troubleshooting operational flows.
   * @param {string} str Message to log
   * @returns {void}
   */
  debug(str) {
    writeLog('debug', str);
  },
};

/**
 * Checks whether a message level is enabled by the configured pool verbosity.
 * @param {'error'|'warn'|'info'|'log'|'debug'} type Message severity to evaluate
 * @returns {boolean} Whether the message should be written
 */
function shouldLog(type) {
  return (LOG_LEVELS[config.log_level] ?? LOG_LEVELS.none) >= LOG_LEVELS[type];
}

/**
 * Writes a message to the console and the active log file.
 * @param {'error'|'warn'|'info'|'log'|'debug'} type Message severity to write
 * @param {string} str Message to log
 * @returns {void}
 */
function writeLog(type, str) {
  if (!shouldLog(type)) {
    return;
  }

  const timestamp = fullTime();

  infoStr.write('\n ' + type + '|' + timestamp + '|' + str);
  console.log(LOG_COLORS[type], type + '|' + timestamp, '\x1b[0m', str);
}

/**
 * Returns the current time formatted for log entries.
 * @returns {string} Time in HH:mm:ss format
 */
function time() {
  return utils.formatDate(Date.now()).hh_mm_ss;
}

/**
 * Returns the current date formatted for the log file and entries.
 * @returns {string} Date in YYYY-MM-DD format
 */
function date() {
  return utils.formatDate(Date.now()).YYYY_MM_DD;
}

/**
 * Returns the current date and time formatted for log entries.
 * @returns {string} Date and time in YYYY-MM-DD HH:mm:ss format
 */
function fullTime() {
  return date() + ' ' + time();
}
