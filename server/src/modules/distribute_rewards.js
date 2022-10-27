import store from './store.js';

import {dbVoters, dbBlocks} from '../helpers/DB.js';
import {notifier, config, utils, log} from '../helpers/index.js';
import {
  SAT,
  DEVIATION,
} from '../helpers/const.js';

class RewardDistributor {
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

  async distribute() {
    if (!config.considerownvote) {
      this.disregardOwnVote();
    }

    const {voters, block, votesWeight} = this;

    if (votesWeight) {
      const distributionPromises = [];

      for (const voter of voters) {
        distributionPromises.push(this.distributeForVoter(voter));
      }

      await Promise.all(distributionPromises);

      if (this.isDistributionComplete) {
        const {distributed, eligibleVotersCount, blockTotalForged} = this;
        const {votersCount, rewardsADM, percent} = distributed;

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

  disregardOwnVote() {
    const {voters} = this;
    const ownVoteIndex = voters.findIndex((voter) => voter.address === config.address);

    if (ownVoteIndex !== -1) {
      const ownVote = voters[ownVoteIndex];

      this.votesWeight -= (+ownVote.balance / ownVote.votesCount);
      this.voters.splice(ownVoteIndex, 1);
    }
  }

  async distributeForVoter(voter) {
    const {block, distributed, votesWeight} = this;

    try {
      const {votesCount} = voter;
      const voterBalance = +voter.balance;

      const isVoterEligible = votesCount && voterBalance > DEVIATION;

      if (isVoterEligible) {
        this.eligibleVotersCount += 1;

        const dbVoter = await this.findOrCreateVoter(voter);

        if (dbVoter) {
          const user = this.calcVoterReward(voterBalance, votesCount, votesWeight);

          const pending = dbVoter.pending + user.reward;

          // TODO: name properties in db normalno
          const updatedVoter = await dbVoters.update(
              {address: voter.address},
              {
                pending,
                votesCount,
                weightADM: user.weight / SAT,
                balanceADM: voterBalance / SAT,
              });

          if (updatedVoter) {
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
            const updatedBlock = await dbBlocks.update(
                {id: block.id},
                {
                  processed: true,
                  ...distributed,
                });

            if (updatedBlock) {
              this.isDistributionComplete = true;
            }
          } else {
            log.error(`Failed to update rewards for ${voter.address} voter on block ${block.id}.`);
          }
        }
      }
    } catch (error) {
      log.error(
          `Error while distributing rewards for ${voter.address} on block ${block.id} (height ${block.height}): ${error}`,
      );
    }
  }

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

  async findOrCreateVoter(voter) {
    const {block} = this;
    const {address} = voter;

    const savedVoter = await dbVoters.findOne({address});

    if (savedVoter) {
      log.info(`Successfully added new voter ${voter.address} on block ${block.id} (height ${block.height}).`);

      return savedVoter;
    }

    const addedVoter = await dbVoters.insert({
      address,
      pending: 0,
      received: 0,
    });

    if (!addedVoter) {
      this.notifyRewardsOnBlock(`could not be distributed. Failed to add voter ${voter.address}`, 'error');
    }

    return addedVoter;
  }

  notifyRewardsOnBlock(message, logLevel) {
    const {block} = this;

    notifier(
        `Pool ${config.logName}: Rewards on block ${block.id} (height ${block.height}) ${message}`,
        logLevel,
    );
  }
}

export default RewardDistributor;
