const ADM_DENOMINATION = 100000000;

function replaceWithDate(text, dateObject) {
  return text.replace(/{([a-zA-Z_]*)}/g, (_, digit) => dateObject[digit]);
}

/**
 * Formats a unix timestamp to string
 * @param {number} timestamp Timestamp to format
 * @return {object} Contains different formatted strings
 */
export function formatDate(timestamp) {
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
}

/**
 * Formats a number using fixed-point notation and digit grouping
 * @example
 * formatNumber(1234.54321) // '1,234.5432'
 * @param {number} num number to format
 * @param {number} maximumFractionDigits
 * @return {string} formatted number
 */
export function formatNumber(num, maximumFractionDigits = 4) {
  const number = +num;

  if (typeof number === 'number' && !isNaN(number)) {
    if (number > 0 && number < 0.01) {
      return '< 0.01';
    }

    return number.toLocaleString('en-US', {maximumFractionDigits});
  }

  return '';
}

export function parseADM(adm) {
  return formatNumber(adm / ADM_DENOMINATION, 2);
}


/**
 * Sorts the given array by sortDirection property sort
 * @param {string} sortDirection - sort direction
 * @param {string | number} prop - property to sort
 * @param {any[]} array - array to sort
 * @return {any[]}
 */
export function sortBy(sortDirection, prop, array) {
  return array.sort((a, b) => {
    const [aVal, bVal] = [a[prop], b[prop]][
      sortDirection === 'ascending' ? 'slice' : 'reverse'
    ]();

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }
    return Number(aVal) - Number(bVal);
  });
}
