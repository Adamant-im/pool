import { jest } from '@jest/globals';

import mongoMock from '../helpers/mongoMock.js';

jest.unstable_mockModule('../../src/repository/mongodb/index.js', () => ({
  __esModule: true,
  default: mongoMock,
}));

jest.unstable_mockModule('../../src/cron/payout.cron.js', () => ({
  __esModule: true,
  default: {
    cronJob: {
      nextDate: jest.fn(),
    },
  },
}));

const {
  formatDelegateName,
  normalizeDelegateRank,
  normalizePendingReward,
} = await import('../../src/modules/store.js');

describe('store delegate helpers', () => {
  it('should wrap delegate names in single quotes', () => {
    expect(formatDelegateName('anylongdelegatename')).toBe('\'anylongdelegatename\'');
  });

  it('should prefer the current delegate rate as rank', () => {
    expect(normalizeDelegateRank({ rate: 42, rank: 1 }, 0)).toBe(42);
  });

  it('should fall back to rank and previous rank when rate is missing or invalid', () => {
    expect(normalizeDelegateRank({ rank: '17' }, 0)).toBe(17);
    expect(normalizeDelegateRank({ rate: 'invalid', rank: '21' }, 0)).toBe(21);
    expect(normalizeDelegateRank({ rate: 'invalid', rank: null }, 35)).toBe(35);
  });

  it('should normalize stored pending rewards before summing accounting totals', () => {
    expect(normalizePendingReward({ pending: '12.5' })).toBe(12.5);
    expect(normalizePendingReward({ pending: 3 })).toBe(3);
    expect(normalizePendingReward({ pending: 'invalid' })).toBe(0);
  });
});
