import {
  DEVIATION,
  SAT,
} from '../defines.js';

import store, { normalizePendingReward } from './store.js';

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
      rewardsADM: Number(block.rewardsADM) || 0,
      votersCount: Number(block.votersCount) || 0,
      percent: Number(block.percent) || 0,
    };
    this.rewardedAddresses = new Set(block.rewardedAddresses ?? []);

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

      const isComplete = this.distributed.votersCount === this.eligibleVotersCount;
      const isBlockUpdated = await this.updateBlockDistribution(isComplete);

      this.isDistributionComplete = isComplete && isBlockUpdated;

      if (this.isDistributionComplete) {
        const { distributed, eligibleVotersCount } = this;
        const { votersCount, rewardsADM, percent } = distributed;

        log.info(
            `Block ${block.id} (height ${block.height}) rewards successfully updated — ` +
            `${votersCount} of ${eligibleVotersCount} eligible voters. ` +
            `Distributed rewards: ${rewardsADM.toFixed(4)} ADM (${percent.toFixed(2)}%).`,
        );
      } else {
        const { distributed, eligibleVotersCount, blockTotalForged } = this;
        const blockTotalForgedInADM = utils.satsToADM(blockTotalForged * config.reward_percentage / 100, 4);

        this.notifyRewardsOnBlock(
            `Block ${block.id} (height ${block.height}) rewards distributed partially — ${distributed.votersCount} of ${eligibleVotersCount} eligible voters. ` +
            `Distributed rewards: ${distributed.rewardsADM.toFixed(4)} of ${blockTotalForgedInADM} ADM. Check log for details.`,
            'warn',
        );
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
      // Untrusted node data: a malformed or malicious response could carry a
      // non-string address that would turn the per-voter MongoDB filters into
      // operator queries (NoSQL injection) or become an invalid payout
      // destination. Reject anything that is not a syntactically valid ADM
      // address before it reaches a DB write or a future payout.
      if (!utils.isAdmAddress(voter.address)) {
        log.warn(
            `Skipping reward distribution on block ${block.id} (height ${block.height}) ` +
            'for a voter with a missing or malformed address from the node response.',
        );
        return;
      }

      const { votesCount } = voter;
      const voterBalance = +voter.balance;

      const isVoterEligible = votesCount && voterBalance > DEVIATION;

      if (isVoterEligible) {
        this.eligibleVotersCount += 1;

        if (this.rewardedAddresses.has(voter.address)) {
          log.debug(
              `Skipping reward distribution for ${voter.address} on block ${block.id} ` +
              `(height ${block.height}) because the voter is already recorded for this block.`,
          );
          return;
        }

        const dbVoter = await this.findOrCreateVoter(voter);

        if (dbVoter) {
          const user = this.calcVoterReward(voterBalance, votesCount, votesWeight);

          const pending = normalizePendingReward(dbVoter) + user.reward;

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

          // Persist this voter's progress on the block right after paying it, so a crash or
          // retry cannot add the same block reward to the voter twice (see recordVoterOnBlock).
          try {
            await this.recordVoterOnBlock(voter.address, user);
          } catch (error) {
            log.error(
                `Failed to record reward progress for ${voter.address} on block ${block.id} ` +
                `(height ${block.height}): ${error}`,
            );
            return;
          }

          distributed.votersCount += 1;
          distributed.rewardsADM += user.reward;
          distributed.percent += user.percent;
          this.rewardedAddresses.add(voter.address);
        }
      }
    } catch (error) {
      log.error(
          `Error while distributing rewards for ${voter.address} on block ${block.id} (height ${block.height}): ${error}`,
      );
    }
  }

  /**
   * Atomically records a single voter's reward progress on the block document.
   *
   * Called right after the voter's pending reward is stored, so the block always
   * reflects who has already been paid. `$addToSet` keeps the record idempotent on
   * retries and `$inc` keeps the block counters correct while voters are distributed
   * in parallel. This shrinks the duplicate-reward window to the gap between the
   * voter update and this single block update, instead of the whole distribution run.
   *
   * @param {string} address Voter address that was just rewarded on this block
   * @param {{reward: number, percent: number}} user Reward computed for the voter
   * @returns {Promise<void>}
   */
  async recordVoterOnBlock(address, user) {
    const { block } = this;

    await mongo.blocksCollection.updateOne(
        { id: block.id },
        {
          $addToSet: { rewardedAddresses: address },
          $inc: {
            votersCount: 1,
            rewardsADM: user.reward,
            percent: user.percent,
          },
        },
    );
  }

  /**
   * Marks the block processed once every eligible voter has been accounted for.
   *
   * Per-voter progress (`rewardedAddresses` and counters) is persisted incrementally
   * in {@link recordVoterOnBlock}, so this only needs to flip the processed flag.
   *
   * @param {boolean} processed Whether every eligible voter has been accounted for
   * @returns {Promise<boolean>} Whether the block flag was saved
   */
  async updateBlockDistribution(processed) {
    const { block, distributed } = this;

    try {
      await mongo.blocksCollection.updateOne(
          { id: block.id },
          { $set: { processed } },
      );

      log.debug(
          `Saved reward distribution progress for block ${block.id} (height ${block.height}): ` +
          `${distributed.votersCount} voters, processed=${processed}.`,
      );

      return true;
    } catch (error) {
      log.error(`Failed to save reward distribution progress for block ${block.id} (height ${block.height}): ${error}`);

      return false;
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
