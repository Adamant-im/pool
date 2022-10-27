import {jest} from '@jest/globals';
import {config} from '../../src/helpers/index.js';
import {dbVoters, dbBlocks} from '../../src/helpers/DB.js';

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
}));

const RewardDistributor = (await import('../../src/modules/distribute_rewards.js')).default;

const mockBlock = {
  id: 1,
  totalForged: 1000,
  height: 666,
};

describe('RewardDistributor.distribute', () => {
  beforeEach(async () => {
    dbVoters.data = {values: []};
    await dbVoters.write();

    dbBlocks.data = {values: []};
    await dbBlocks.write();
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

    await dbBlocks.insert(mockBlock);

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
    expect(rewardDistributor.isDistributionComplete).toBe(true);
  });
});

describe('RewardDistributor.findOrCreateVoter', () => {
  beforeEach(() => {
    dbVoters.data = {values: []};
    return dbVoters.write();
  });

  const rewardDistributor = new RewardDistributor(mockBlock);
  const mockVoter = {address: config.address};

  describe('when there is no saved voter', () => {
    it('should create a new voter and return it', async () => {
      const voter = await rewardDistributor.findOrCreateVoter(mockVoter);

      const savedVoter = await dbVoters.findOne(mockVoter);

      expect(voter).toStrictEqual({
        ...mockVoter,
        pending: 0,
        received: 0,
      });
      expect(savedVoter).toStrictEqual(voter);
    });
  });

  describe('when there is saved voter', () => {
    it('should return saved voter', async () => {
      await dbVoters.insert({...mockVoter, pending: 1, received: 0});

      const voter = await rewardDistributor.findOrCreateVoter(mockVoter);

      expect(voter).toStrictEqual({
        ...mockVoter,
        pending: 1,
        received: 0,
      });
    });
  });
});
