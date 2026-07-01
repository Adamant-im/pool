import { jest } from '@jest/globals';

const notifier = jest.fn();

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  __esModule: true,
  config: {
    logName: 'test-pool (U123456789)',
  },
  notifier,
}));

const {
  notifyPoolLockedAtStartup,
  notifyPoolUnlocked,
} = await import('../../src/modules/lock_notifications.js');

describe('lock notifications', () => {
  beforeEach(() => {
    notifier.mockClear();
  });

  it('sends a warning when the pool starts locked', () => {
    notifyPoolLockedAtStartup();

    expect(notifier).toHaveBeenCalledWith(
        expect.stringContaining('Pool test-pool (U123456789): Pool started LOCKED'),
        'warn',
    );
    expect(notifier).toHaveBeenCalledWith(
        expect.stringContaining('waiting for the operator password'),
        'warn',
    );
  });

  it('sends an info notification when the pool unlocks', () => {
    notifyPoolUnlocked('U123456789');

    expect(notifier).toHaveBeenCalledWith(
        'Pool U123456789: Pool unlocked. Payouts and ADM notifications are enabled.',
        'info',
    );
  });
});
