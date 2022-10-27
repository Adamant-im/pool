import cron from '../../src/helpers/cron.js';
import utils from '../../src/helpers/utils.js';

describe('Initializing a cron using the day of the week', () => {
  afterEach(() => cron.payoutCronJob.stop());

  const daysOfTheWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  test.each(daysOfTheWeek)('should call a cron job with correct pattern', (day) => {
    const cronResponseCode = cron.initCron(day);

    expect(cronResponseCode).not.toBe(-1);
    expect(cron.payoutCronJob.cronTime.source).toBe(`0 0 * * ${day}`);
  });
});

describe('Initializing a cron using a pattern', () => {
  afterEach(() => cron.payoutCronJob.stop());

  const patternTable = [
    ['1h', '0 * * * *'],
    ['1d', '0 0 * * *'],
    ['5d', '0 0 */5 * *'],
    ['10d', '0 0 */10 * *'],
    ['15d', '0 0 */15 * *'],
    ['30d', '0 0 1 * *'],
  ];

  test.each(patternTable)('should init a cron with correct pattern based on the period', (period, pattern) => {
    const cronResponseCode = cron.initCron(period);

    expect(cronResponseCode).not.toBe(-1);
    expect(cron.payoutCronJob.cronTime.source).toBe(pattern);
  });
});

describe('Invalid period', () => {
  beforeAll(() => cron.payoutCronJob = {});

  const invalidPeriods = [
    '32d',
    '2h',
    'Sar',
    '',
    null,
  ];

  test.each(invalidPeriods)('should return -1', (period) => {
    const cronResponseCode = cron.initCron(period);

    expect(cronResponseCode).toBe(-1);
    expect(utils.isPlainObject(cron.payoutCronJob)).toBeTruthy();
  });
});
