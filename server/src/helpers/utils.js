import { EPOCH, SAT } from '../defines.js';

/**
 * Replaces `{token}` placeholders in a template with values from a date parts object.
 * @param {string} text Template containing `{token}` placeholders
 * @param {object} dateObject Map of token names to their replacement strings
 * @returns {string} Template with placeholders substituted
 */
function replaceWithDate(text, dateObject) {
  return text.replace(/{([a-zA-Z_]*)}/g, (_, digit) => dateObject[digit]);
}

export default {
  /**
   * Strict object type check. Only returns true
   * for plain JavaScript objects.
   * @param {any} val Value to check
   * @return {boolean}
   */
  isPlainObject(val) {
    const _toString = Object.prototype.toString;

    return _toString.call(val) === '[object Object]';
  },

  /**
   * Converts provided `time` to ADAMANT's epoch timestamp
   * @param {number=} time timestamp to convert
   * @return {number}
   */
  epochTime(time) {
    if (!time) {
      time = Date.now();
    }

    return Math.floor((time - EPOCH) / 1000);
  },

  /**
   * Converts ADAMANT's epoch timestamp to a Unix timestamp
   * @param {number} epochTime timestamp to convert
   * @return {number}
   */
  toTimestamp(epochTime) {
    return epochTime * 1000 + EPOCH;
  },

  /**
   * Converts an amount in sats to a fixed-precision ADM string.
   * @param {number|string} sats Amount in sats (1 ADM = 1e8 sats)
   * @param {number} [decimals=8] Number of decimal places to keep
   * @return {string} Amount in ADM, fixed to `decimals` places
   */
  satsToADM(sats, decimals = 8) {
    return (+sats / SAT).toFixed(decimals);
  },

  /**
   * Returns the current Unix timestamp in milliseconds.
   * @return {number}
   */
  unix() {
    return Date.now();
  },

  /**
   * Formats unix timestamp to string
   * @param {number} timestamp Timestamp to format
   * @return {object} Contains different formatted strings
   */
  formatDate(timestamp) {
    if (!timestamp) {
      return false;
    }

    const dateObject = new Date(timestamp);

    const formattedDate = {
      year: dateObject.getFullYear(),
      month: dateObject.getMonth() + 1,
      date: dateObject.getDate(),
      hours: dateObject.getHours(),
      minutes: dateObject.getMinutes(),
      seconds: dateObject.getSeconds(),
    };

    for (const digit in formattedDate) {
      if ({}.hasOwnProperty.call(formattedDate, digit)) {
        formattedDate[digit] = String(formattedDate[digit]).padStart(2, '0');
      }
    }

    formattedDate.YYYY_MM_DD = replaceWithDate('{year}-{month}-{date}', formattedDate);
    formattedDate.YYYY_MM_DD_hh_mm = replaceWithDate('{YYYY_MM_DD} {hours}:{minutes}', formattedDate);
    formattedDate.hh_mm_ss = replaceWithDate('{hours}:{minutes}:{seconds}', formattedDate);

    return formattedDate;
  },

  /**
   * Formats a number with thin-space thousand separators, optionally bolding the integer part.
   * @param {number|string} num Number to format
   * @param {boolean} [doBold] Whether to wrap the integer part in Markdown bold markers
   * @return {string} Formatted number string
   */
  thousandSeparator(num, doBold) {
    const parts = (num + '').split('.');
    const main = parts[0];
    const len = main.length;
    let output = '';
    let i = len - 1;

    while (i >= 0) {
      output = main.charAt(i) + output;
      if ((len - i) % 3 === 0 && i > 0) {
        output = ' ' + output;
      }
      --i;
    }
    if (parts.length > 1) {
      if (doBold) {
        output = `**${output}**.${parts[1]}`;
      } else {
        output = `${output}.${parts[1]}`;
      }
    }
    return output;
  },

  /**
   * Returns the smallest positive value representable at the given decimal precision.
   * @param {number} decimals Number of decimal places
   * @return {number} Precision step, e.g. `0.01` for 2 decimals
   */
  getPrecision(decimals) {
    return +(Math.pow(10, -decimals).toFixed(decimals));
  },

  /**
   * Extracts the file name from a module path or id.
   * @param {string} id Module path using `/` or `\` separators
   * @return {string} Trailing file name, or an empty string when no separator is present
   */
  getModuleName(id) {
    let n = id.lastIndexOf('\\');

    if (n === -1) {
      n = id.lastIndexOf('/');
    }

    if (n === -1) {
      return '';
    } else {
      return id.substring(n + 1);
    }
  },
};
