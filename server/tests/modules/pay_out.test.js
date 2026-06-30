import { jest } from '@jest/globals';

import mongoMock from '../helpers/mongoMock.js';

const sendTokens = jest.fn();
const log = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
};
const notifier = jest.fn();

jest.unstable_mockModule('../../src/repository/mongodb/index.js', () => ({
  __esModule: true,
  default: mongoMock,
}));

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  __esModule: true,
  adamantApiClient: {
    sendTokens,
  },
  config: {
    donate_percentage: 0,
    donatewallet: '',
    logName: 'test-pool',
    maintenancewallet: '',
    minpayout: 0.51,
    passPhrase: 'test passphrase',
    poolsShare: 20,
  },
  log,
  notifier,
  utils: {
    isAdmAddress: (value) => typeof value === 'string' && /^U[0-9]{6,}$/.test(value),
  },
}));

jest.unstable_mockModule('../../src/modules/secret.js', () => ({
  __esModule: true,
  default: {
    isUnlocked: () => true,
    getPassphrase: () => 'test passphrase',
  },
}));

jest.unstable_mockModule('../../src/modules/store.js', () => ({
  __esModule: true,
  default: {
    delegate: {
      balance: 100_000_000_000,
    },
    periodInfo: {
      forgedBlocks: 1,
      totalForgedADM: 10,
      userRewardsADM: 8,
    },
  },
  normalizePendingReward(voter) {
    const pending = Number(voter.pending);

    return Number.isFinite(pending) ? pending : 0;
  },
}));

const { default: Payer, getVotersRewards } = await import('../../src/modules/pay_out.js');

describe('getVotersRewards', () => {
  it('should split voters and sum pending rewards numerically', () => {
    const result = getVotersRewards([
      { address: 'U123456789', pending: '1.25' },
      { address: 'U2', pending: '0.25' },
      { address: 'U3', pending: 'invalid' },
    ]);

    expect(result.votersToReward.map((voter) => voter.address)).toStrictEqual(['U123456789']);
    expect(result.votersBelowMin.map((voter) => voter.address)).toStrictEqual(['U2', 'U3']);
    expect(result.pendingUserRewards).toBe(1.25);
    expect(result.belowMinRewards).toBe(0.25);
  });
});

describe('Payer.payVoter', () => {
  beforeEach(() => {
    mongoMock.resetAll();
    sendTokens.mockReset();
    Object.values(log).forEach((mock) => mock.mockClear());
  });

  it('should pay a voter, reset pending rewards, and save the transaction', async () => {
    sendTokens.mockResolvedValue({
      success: true,
      transactionId: 'tx-1',
    });

    await mongoMock.votersCollection.insertOne({
      address: 'U123456789',
      pending: '1.25',
      received: '2',
    });

    const payer = new Payer();
    const result = await payer.payVoter({
      address: 'U123456789',
      pending: '1.25',
      received: '2',
    });

    const voter = await mongoMock.votersCollection.findOne({ address: 'U123456789' });
    const transaction = await mongoMock.transactionsCollection.findOne({ transactionId: 'tx-1' });

    expect(sendTokens).toHaveBeenCalledWith('test passphrase', 'U123456789', 0.75);
    expect(result).toStrictEqual({
      amount: 0.75,
      isUpdated: true,
      isTransactionSaved: true,
    });
    expect(voter.pending).toBe(0);
    expect(voter.received).toBe(3.25);
    expect(transaction.payoutcount).toBe(1.25);
  });

  it('should not sign a payout for a record with a malformed address', async () => {
    const payer = new Payer();
    const result = await payer.payVoter({
      address: { $ne: null },
      pending: '1.25',
      received: '2',
    });

    expect(result).toBeUndefined();
    expect(sendTokens).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('malformed address'));
  });

  it('should keep pending rewards unchanged when the API rejects the payout', async () => {
    sendTokens.mockResolvedValue({
      success: false,
      errorMessage: 'network unavailable',
    });

    await mongoMock.votersCollection.insertOne({
      address: 'U123456789',
      pending: 1.25,
      received: 2,
    });

    const payer = new Payer();
    const result = await payer.payVoter({
      address: 'U123456789',
      pending: 1.25,
      received: 2,
    });

    const voter = await mongoMock.votersCollection.findOne({ address: 'U123456789' });

    expect(result).toBeUndefined();
    expect(voter.pending).toBe(1.25);
    expect(voter.received).toBe(2);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('network unavailable'));
  });
});
