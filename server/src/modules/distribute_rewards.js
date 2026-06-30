import {
  DEVIATION,
  SAT,
} from '../defines.js';

import store from './store.js';

import { config, log, notifier, utils } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';

class RewardDistributor {
  /**
   * Creates a reward distributor for a forged block.
   * @param {object} block Forged block returned by the ADAMANT node API
   */
  constructor(block) {
    this.block = block;
    this.blockTotalForged = +block.totalForged;

    this.distributed = {
      rewardsADM: 0,
      votersCount: 0,
      percent: 0,
    };

    this.voters = store.delegate.voters;
    this.votesWeight = store.delegate.votesWeight;
    this.eligibleVotersCount = 0;

    this.isDistributionComplete = false;
  }

  /**
   * Calculates and stores reward updates for all eligible voters of the block.
   * @returns {Promise<void>}
   */
  async distribute() {
    if (!config.considerownvote) {
      this.disregardOwnVote();
    }

    const { voters, block, votesWeight } = this;

    if (votesWeight) {
      const distributionPromises = [];

      for (const voter of voters) {
        distributionPromises.push(this.distributeForVoter(voter));
      }

      await Promise.all(distributionPromises);

      if (this.isDistributionComplete) {
        const { distributed, eligibleVotersCount, blockTotalForged } = this;
        const { votersCount, rewardsADM, percent } = distributed;

        if (distributed.votersCount === eligibleVotersCount) {
          log.info(
              `Block ${block.id} (height ${block.height}) rewards successfully updated — ` +
              `${votersCount} of ${eligibleVotersCount} eligible voters, ` +
              `distributedRewards: ${rewardsADM.toFixed(4)} ADM (${percent.toFixed(2)}%).`,
          );
        } else {
          const blockTotalForgedInADM = utils.satsToADM(blockTotalForged * config.reward_percentage / 100, 4);

          this.notifyRewardsOnBlock(
              `distributed partially — ${votersCount} of ${eligibleVotersCount} eligible voters, ` +
              `distributedRewards: ${rewardsADM.toFixed(4)} of ${blockTotalForgedInADM} ADM.`,
              'warn',
          );
        }
      } else {
        this.notifyRewardsOnBlock('could not be distributed. Check logs.', 'error');
      }
    }
  }

  /**
   * Removes the delegate's own vote from the current distribution weight.
   * @returns {void}
   */
  disregardOwnVote() {
    const { voters } = this;
    const ownVoteIndex = voters.findIndex((voter) => voter.address === config.address);

    if (ownVoteIndex !== -1) {
      const ownVote = voters[ownVoteIndex];

      this.votesWeight -= (+ownVote.balance / ownVote.votesCount);
      this.voters.splice(ownVoteIndex, 1);
    }
  }

  /**
   * Calculates and persists the reward for a single voter when the voter is eligible.
   * @param {object} voter Voter account returned by the ADAMANT node API
   * @returns {Promise<void>}
   */
  async distributeForVoter(voter) {
    const { block, distributed, votesWeight } = this;

    try {
      const { votesCount } = voter;
      const voterBalance = +voter.balance;

      const isVoterEligible = votesCount && voterBalance > DEVIATION;

      if (isVoterEligible) {
        this.eligibleVotersCount += 1;

        const dbVoter = await this.findOrCreateVoter(voter);

        if (dbVoter) {
          const user = this.calcVoterReward(voterBalance, votesCount, votesWeight);

          const pending = dbVoter.pending + user.reward;

          // Keep existing DB field names for compatibility with stored voter records.
          try {
            await mongo.votersCollection.updateOne(
                { address: voter.address },
                {
                  $set: {
                    pending,
                    votesCount,
                    weightADM: user.weight / SAT,
                    balanceADM: voterBalance / SAT,
                  },
                });
          } catch (error) {
            log.error(`Error while distributing rewards for ${voter.address} on block ${block.id} (height ${block.height}): ${error}`);
            return;
          }

          const userWeightInADM = utils.satsToADM(user.weight, 0);

          log.log(
              `Voter's rewards successfully updated on block ${block.id} (height ${block.height}): ` +
              `reward for this block ${user.reward.toFixed(8)} ADM, ${pending.toFixed(8)} ADM payouts pending for ` +
              `${voter.address}. userWeight: ${userWeightInADM} ADM (${user.percent.toFixed(2)}%).`,
          );

          distributed.votersCount += 1;
          distributed.rewardsADM += user.reward;
          distributed.percent += user.percent;

          // Mark block processed, if any voter gets reward
          try {
            await mongo.blocksCollection.updateOne(
                { id: block.id },
                {
                  $set: {
                    processed: true,
                    ...distributed,
                  },
                });
          } catch (error) {
            log.error(`Error while distributing rewards for ${voter.address} on block ${block.id} (height ${block.height}): ${error}`);
            return;
          }

          this.isDistributionComplete = true;
        }
      }
    } catch (error) {
      log.error(
          `Error while distributing rewards for ${voter.address} on block ${block.id} (height ${block.height}): ${error}`,
      );
    }
  }

  /**
   * Calculates a voter's reward share for the current block.
   * @param {number} voterBalance Voter balance in sats
   * @param {number} votesCount Number of delegates the voter supports
   * @param {number} votesWeight Total eligible vote weight in sats
   * @returns {{weight: number, percent: number, reward: number}} Reward weight, percentage, and ADM amount
   */
  calcVoterReward(voterBalance, votesCount, votesWeight) {
    const weight = voterBalance / votesCount;
    const percent = ((weight / votesWeight) * config.reward_percentage * store.delegate.productivity) / 100;
    const reward = (this.blockTotalForged * percent) / (SAT * 100);

    return {
      weight,
      percent,
      reward,
    };
  }

  /**
   * Returns an existing voter record or creates a new pending-reward record.
   * @param {object} voter Voter account returned by the ADAMANT node API
   * @returns {Promise<object>} MongoDB voter document or insert result
   */
  async findOrCreateVoter(voter) {
    const { block } = this;
    const { address } = voter;

    let savedVoter;
    try {
      savedVoter = await mongo.votersCollection.findOne({ address });
    } catch (error) {
      throw new Error(`Failed to get voter ${address}`, { cause: error });
    }

    if (savedVoter) {
      log.info(`Found voter ${voter.address} on block ${block.id} (height ${block.height}).`);

      return savedVoter;
    }

    const newVoter = {
      address,
      pending: 0,
      received: 0,
    };

    try {
      await mongo.votersCollection.insertOne(newVoter);

      log.info(`Successfully added new voter ${voter.address} on block ${block.id} (height ${block.height}).`);

      return newVoter;
    } catch (error) {
      this.notifyRewardsOnBlock(`could not be distributed. Failed to add voter ${voter.address}`, 'error');
      throw new Error(`Failed to add voter ${address}`, { cause: error });
    }
  }

  /**
   * Sends and logs a block-specific reward distribution notification.
   * @param {string} message Block-specific distribution status message
   * @param {string} logLevel Notification severity level
   * @returns {void}
   */
  notifyRewardsOnBlock(message, logLevel) {
    const { block } = this;

    notifier(
        `Pool ${config.logName}: Rewards on block ${block.id} (height ${block.height}) ${message}`,
        logLevel,
    );
  }
}

export default RewardDistributor;
