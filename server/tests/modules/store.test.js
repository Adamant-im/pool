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
  resolveDelegateRank,
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

  it('should resolve delegate rank from its position in the delegates list', async () => {
    const apiClient = {
      getDelegates: jest.fn()
          .mockResolvedValueOnce({
            success: true,
            totalCount: 3,
            delegates: [
              { username: 'first-delegate', publicKey: 'first-public-key', rank: 1 },
              { username: 'second-delegate', publicKey: 'second-public-key', rank: 2 },
            ],
          })
          .mockResolvedValueOnce({
            success: true,
            totalCount: 3,
            delegates: [
              { username: 'anylongdelegatename', publicKey: 'target-public-key', rank: 1 },
            ],
          }),
    };

    await expect(
        resolveDelegateRank(
            { username: 'anylongdelegatename', publicKey: 'target-public-key', rank: 1 },
            0,
            apiClient,
        ),
    ).resolves.toBe(3);
  });

  it('should keep endpoint rank when the delegates list cannot be read', async () => {
    const apiClient = {
      getDelegates: jest.fn().mockResolvedValue({
        success: false,
        errorMessage: 'Node is unavailable',
      }),
    };

    await expect(
        resolveDelegateRank({ username: 'anylongdelegatename', rank: 44 }, 0, apiClient),
    ).resolves.toBe(44);
  });
});
