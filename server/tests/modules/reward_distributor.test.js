import { config } from '../../src/helpers/index.js';
import { jest } from '@jest/globals';

import mongoMock from '../helpers/mongoMock.js';

jest.unstable_mockModule('../../src/repository/mongodb/index.js', () => ({
  __esModule: true,
  default: mongoMock,
}));

jest.unstable_mockModule('../../src/modules/store.js', () => ({
  __esModule: true,
  default: {
    delegate: {
      votesWeight: 100000,
      productivity: 100,
      voters: [
        {
          username: 'test',
          address: config.address,
          publicKey: config.publicKey,
          balance: '50000',
          votesCount: 2,
        },
        {
          username: 'thunder',
          address: 'U3247657843720097949',
          publicKey: 'fc7151dcc08bda712c075fbfc524e10828bbbaad56ac4001cd3f5a9b93b2ea27',
          balance: '5000',
          votesCount: 50,
        },
      ],
    },
  },
  normalizePendingReward(voter) {
    const pending = Number(voter.pending);

    return Number.isFinite(pending) ? pending : 0;
  },
  buildVoterPublicFields(voter) {
    return {
      username: voter.username ?? '',
    };
  },
}));

const RewardDistributor = (await import('../../src/modules/distribute_rewards.js')).default;

const mockBlock = {
  id: 1,
  totalForged: 1000,
  height: 666,
};

describe('RewardDistributor.distribute', () => {
  beforeEach(async () => {
    mongoMock.resetAll();
  });

  describe('when config.considerownvote === false', () => {
    it('should not consider own vote', () => {
      const rewardDistributor = new RewardDistributor(mockBlock);

      const findOwnVote = () => (
        rewardDistributor.voters.find((voter) => voter.address === config.address)
      );

      rewardDistributor.disregardOwnVote();

      expect(rewardDistributor.votesWeight).toBe(75000);
      expect(findOwnVote()).toBeUndefined();
    });
  });

  it('should distribute rewards for voter', async () => {
    const rewardDistributor = new RewardDistributor(mockBlock);

    await mongoMock.blocksCollection.insertOne(mockBlock);

    const mockVoter = {
      address: config.address,
      votesCount: 10,
      balance: '1000000',
    };

    await rewardDistributor.distributeForVoter(mockVoter);

    expect(rewardDistributor.distributed).toStrictEqual({
      votersCount: 1,
      rewardsADM: 0.000008,
      percent: 80,
    });
  });

  it('should skip a voter with a malformed address without writing to the DB', async () => {
    const rewardDistributor = new RewardDistributor(mockBlock);

    await mongoMock.blocksCollection.insertOne(mockBlock);

    // A malicious/malformed node response could carry an object address that
    // would otherwise become a MongoDB operator query.
    await rewardDistributor.distributeForVoter({
      address: { $ne: null },
      votesCount: 10,
      balance: '1000000',
    });

    const voters = await mongoMock.votersCollection.find({}).toArray();

    expect(voters).toHaveLength(0);
    expect(rewardDistributor.eligibleVotersCount).toBe(0);
    expect(rewardDistributor.distributed.votersCount).toBe(0);
  });

  it('should add rewards to stored pending values numerically', async () => {
    const rewardDistributor = new RewardDistributor(mockBlock);

    await mongoMock.blocksCollection.insertOne(mockBlock);
    await mongoMock.votersCollection.insertOne({
      address: 'U3247657843720097949',
      pending: '1.25',
      received: 0,
    });

    await rewardDistributor.distributeForVoter({
      address: 'U3247657843720097949',
      votesCount: 10,
      balance: '1000000',
    });

    const savedVoter = await mongoMock.votersCollection.findOne({ address: 'U3247657843720097949' });

    expect(savedVoter.pending).toBeCloseTo(1.250008);
  });

  it('should not distribute the same block reward twice to an already recorded voter', async () => {
    const block = {
      ...mockBlock,
      id: 2,
      processed: false,
      rewardedAddresses: ['U3247657843720097949'],
      votersCount: 1,
      rewardsADM: 0.000008,
      percent: 80,
    };
    const rewardDistributor = new RewardDistributor(block);

    await mongoMock.blocksCollection.insertOne(block);

    await rewardDistributor.distributeForVoter({
      address: 'U3247657843720097949',
      votesCount: 10,
      balance: '1000000',
    });
    await rewardDistributor.updateBlockDistribution(
        rewardDistributor.distributed.votersCount === rewardDistributor.eligibleVotersCount,
    );

    const savedBlock = await mongoMock.blocksCollection.findOne({ id: 2 });
    const savedVoter = await mongoMock.votersCollection.findOne({ address: 'U3247657843720097949' });

    expect(savedVoter).toBeUndefined();
    expect(savedBlock.processed).toBe(true);
    expect(savedBlock.votersCount).toBe(1);
    expect(savedBlock.rewardsADM).toBe(0.000008);
  });

  it('should persist voter progress on the block before the block is marked processed', async () => {
    const block = { ...mockBlock, id: 3, processed: false, rewardedAddresses: [] };
    const rewardDistributor = new RewardDistributor(block);

    await mongoMock.blocksCollection.insertOne(block);

    // Only the per-voter step runs; the final updateBlockDistribution() never happens,
    // simulating a crash right after the voter reward was stored.
    await rewardDistributor.distributeForVoter({
      address: 'U3247657843720097949',
      votesCount: 10,
      balance: '1000000',
    });

    const savedBlock = await mongoMock.blocksCollection.findOne({ id: 3 });

    // Progress is already durable, so a retry can skip this voter instead of paying again.
    expect(savedBlock.rewardedAddresses).toContain('U3247657843720097949');
    expect(savedBlock.votersCount).toBe(1);
    expect(savedBlock.rewardsADM).toBeCloseTo(0.000008);
    expect(savedBlock.processed).toBe(false);
  });

  it('should not re-pay a voter recorded by incremental progress when the block is retried', async () => {
    const firstRunBlock = { ...mockBlock, id: 4, processed: false, rewardedAddresses: [] };
    const voter = { address: 'U3247657843720097949', votesCount: 10, balance: '1000000' };

    await mongoMock.blocksCollection.insertOne(firstRunBlock);

    // First (crashed) run pays the voter and records progress, but never marks the block processed.
    await new RewardDistributor(firstRunBlock).distributeForVoter(voter);

    const partiallySavedBlock = await mongoMock.blocksCollection.findOne({ id: 4 });
    const pendingAfterFirstRun = (
      await mongoMock.votersCollection.findOne({ address: voter.address })
    ).pending;

    // Retry seeds the distributor from the saved block, exactly as block_parser does.
    await new RewardDistributor({ ...firstRunBlock, ...partiallySavedBlock }).distributeForVoter(voter);

    const voterAfterRetry = await mongoMock.votersCollection.findOne({ address: voter.address });

    expect(voterAfterRetry.pending).toBe(pendingAfterFirstRun);
  });
});

describe('RewardDistributor.findOrCreateVoter', () => {
  beforeEach(() => {
    mongoMock.resetAll();
  });

  const rewardDistributor = new RewardDistributor(mockBlock);
  const mockVoter = { address: config.address };

  describe('when there is no saved voter', () => {
    it('should create a new voter and return it', async () => {
      const voter = await rewardDistributor.findOrCreateVoter(mockVoter);

      const savedVoter = await mongoMock.votersCollection.findOne(mockVoter);

      expect(voter).toStrictEqual({
        ...mockVoter,
        username: '',
        pending: 0,
        received: 0,
      });
      expect(savedVoter).toStrictEqual(voter);
    });
  });

  describe('when there is saved voter', () => {
    it('should return saved voter', async () => {
      await mongoMock.votersCollection.insertOne({ ...mockVoter, pending: 1, received: 0 });

      const voter = await rewardDistributor.findOrCreateVoter(mockVoter);

      expect(voter).toStrictEqual({
        ...mockVoter,
        pending: 1,
        received: 0,
      });
    });
  });
});
