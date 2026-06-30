import { jest } from '@jest/globals';

const payOut = jest.fn();
let unlocked = true;

jest.unstable_mockModule('../../src/modules/pay_out.js', () => ({
  __esModule: true,
  default: class Payer {
    payOut(...args) {
      return payOut(...args);
    }
  },
}));

jest.unstable_mockModule('../../src/modules/secret.js', () => ({
  __esModule: true,
  default: {
    isUnlocked: () => unlocked,
  },
}));

jest.unstable_mockModule('../../src/helpers/config/reader.js', () => ({
  __esModule: true,
  default: { address: 'U1', payoutperiod: '1d' },
}));

jest.unstable_mockModule('../../src/helpers/log.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));

const cron = (await import('../../src/cron/payout.cron.js')).default;

describe('Deferred payout marker', () => {
  beforeEach(() => {
    payOut.mockReset();
    payOut.mockResolvedValue(undefined);
    cron.deferredPayout = false;
    unlocked = true;
  });

  describe('runScheduled', () => {
    it('marks the payout deferred when the pool is locked', async () => {
      unlocked = false;

      await cron.runScheduled();

      expect(cron.deferredPayout).toBe(true);
      expect(payOut).toHaveBeenCalledTimes(1);
    });

    it('does not mark a deferred payout when the pool is unlocked', async () => {
      await cron.runScheduled();

      expect(cron.deferredPayout).toBe(false);
      expect(payOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('runDeferred', () => {
    it('does nothing when no payout was deferred', async () => {
      await cron.runDeferred();

      expect(payOut).not.toHaveBeenCalled();
    });

    it('keeps the marker and does not pay when the pool is locked again', async () => {
      cron.deferredPayout = true;
      unlocked = false;

      await cron.runDeferred();

      expect(payOut).not.toHaveBeenCalled();
      expect(cron.deferredPayout).toBe(true);
    });

    it('runs the payout and clears the marker after a successful unlocked attempt', async () => {
      cron.deferredPayout = true;

      await cron.runDeferred();

      expect(payOut).toHaveBeenCalledTimes(1);
      expect(cron.deferredPayout).toBe(false);
    });

    it('keeps the marker when the payout attempt throws', async () => {
      cron.deferredPayout = true;
      payOut.mockRejectedValue(new Error('node down'));

      await cron.runDeferred();

      expect(payOut).toHaveBeenCalledTimes(1);
      expect(cron.deferredPayout).toBe(true);
    });
  });
});
