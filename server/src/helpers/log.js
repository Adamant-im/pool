import config from './config/reader.js';
import utils from './utils.js';

import fs from 'fs';

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

const infoStr = fs.createWriteStream(`./logs/${date()}.log`, {
  flags: 'a',
});

export default {
  start() {
    infoStr.write(`\n\n[The pool started] _________________${fullTime()}_________________\n`);
  },
  error(str) {
    if (['error', 'warn', 'info', 'log'].includes(config.log_level)) {
      infoStr.write(`\n ` + 'error|' + fullTime() + '|' + str);
      console.log('\x1b[31m', 'error|' + fullTime(), '\x1b[0m', str);
    }
  },
  warn(str) {
    if (['warn', 'info', 'log'].includes(config.log_level)) {
      console.log('\x1b[33m', 'warn|' + fullTime(), '\x1b[0m', str);
      infoStr.write(`\n ` + 'warn|' + fullTime() + '|' + str);
    }
  },
  info(str) {
    if (['info', 'log'].includes(config.log_level)) {
      console.log('\x1b[32m', 'info|' + fullTime(), '\x1b[0m', str);
      infoStr.write(`\n ` + 'info|' + fullTime() + '|' + str);
    }
  },
  log(str) {
    if (['log'].includes(config.log_level)) {
      console.log('\x1b[34m', 'log|' + fullTime(), '\x1b[0m', str);
      infoStr.write(`\n ` + 'log|[' + fullTime() + '|' + str);
    }
  },
};

function time() {
  return utils.formatDate(Date.now()).hh_mm_ss;
}

function date() {
  return utils.formatDate(Date.now()).YYYY_MM_DD;
}

function fullTime() {
  return date() + ' ' + time();
}
