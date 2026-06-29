import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/modules/pay_out.js', () => ({
  __esModule: true,
  default: class Payer {
    payOut() {}
  },
}));

const cron = (await import('../../src/cron/payout.cron.js')).default;

describe('Initializing a cron using the day of the week', () => {
  afterEach(() => cron.cronJob.stop());

  const daysOfTheWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  test.each(daysOfTheWeek)('should call a cron job with correct pattern', (day) => {
    cron.init(day);

    expect(cron.cronJob.cronTime.source).toBe(`0 0 * * ${day}`);
  });
});

describe('Initializing a cron using a pattern', () => {
  afterEach(() => cron.cronJob.stop());

  const patternTable = [
    ['1h', '0 * * * *'],
    ['1d', '0 0 * * *'],
    ['5d', '0 0 */5 * *'],
    ['10d', '0 0 */10 * *'],
    ['15d', '0 0 */15 * *'],
    ['30d', '0 0 1 * *'],
  ];

  test.each(patternTable)('should init a cron with correct pattern based on the period', (period, pattern) => {
    cron.init(period);

    expect(cron.cronJob.cronTime.source).toBe(pattern);
  });
});

describe('Invalid period', () => {
  const invalidPeriods = [
    '32d',
    '2h',
    'Sar',
    '',
    null,
  ];

  test.each(invalidPeriods)('should throw an error', (period) => {
    expect(() => cron.init(period)).toThrow('Invalid cronTime');
  });
});
