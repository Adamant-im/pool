import * as process from 'node:process';
import { SAT, UPDATE_DELEGATE_INTERVAL } from '../defines.js';
import { adamantApiClient, config, log, utils } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';
import payoutCron from '../cron/payout.cron.js';

/**
 * Formats a delegate name consistently for logs and notifications.
 * @param {string} delegateName Delegate username returned by the node API
 * @returns {string} Delegate username wrapped in single quotes
 */
export function formatDelegateName(delegateName) {
  return `'${String(delegateName).replaceAll('\'', '\\\'')}'`;
}

/**
 * Reads the active delegate position from current and legacy API fields.
 * @param {object} delegate Delegate data returned by the node API
 * @param {number} fallbackRank Rank to keep when the API value is missing or invalid
 * @returns {number} Numeric delegate rank
 */
export function normalizeDelegateRank(delegate, fallbackRank = 0) {
  const rankCandidates = [delegate.rate, delegate.rank, fallbackRank];

  for (const rank of rankCandidates) {
    if (rank === undefined || rank === null) {
      continue;
    }

    const numericRank = Number(rank);

    if (Number.isFinite(numericRank)) {
      return numericRank;
    }
  }

  return 0;
}

/**
 * Reads a voter's pending rewards as a finite ADM amount.
 * @param {object} voter Voter database record that may contain numeric or string pending rewards
 * @returns {number} Pending rewards in ADM, or 0 when the stored value is invalid
 */
export function normalizePendingReward(voter) {
  const pending = Number(voter.pending);

  return Number.isFinite(pending) ? pending : 0;
}

/**
 * Builds public voter metadata that is safe to expose in the dashboard.
 * @param {object} voter Voter account returned by the ADAMANT node API
 * @returns {{username: string, votesCount?: number, balanceADM?: number, weightADM?: number}} Public voter fields
 */
export function buildVoterPublicFields(voter) {
  const votesCount = Number(voter.votesCount);
  const balance = Number(voter.balance);
  const publicFields = {
    username: typeof voter.username === 'string' ? voter.username : '',
  };

  if (Number.isFinite(votesCount)) {
    publicFields.votesCount = votesCount;
  }

  if (Number.isFinite(balance)) {
    publicFields.balanceADM = balance / SAT;
  }

  if (Number.isFinite(balance) && votesCount > 0) {
    publicFields.weightADM = balance / votesCount / SAT;
  }

  return publicFields;
}

const store = {
  isDistributingRewards: false,
  periodInfo: {
    totalForgedSats: 0,
    totalForgedADM: 0,
    userRewardsADM: 0,
    forgedBlocks: 0,
    previousRunTimestamp: 0,
    previousRunEpochtime: 0,
    nextRunMoment: {},
    nextRunTimestamp: 0,
    nextRunDateString: '',
  },
  delegate: {
    address: config.address,
    publicKey: config.publicKey,
    balance: 0,
    voters: [],
    votesWeight: 0,
    forged: 0,
    rewards: 0,
    fees: 0,
    rank: 0,
    approval: 0,
    productivity: 0,
    pendingRewardsADM: 0,
  },

  /**
   * Refreshes delegate, voters, balance, and period stats in parallel.
   * @returns {Promise<unknown[]>} Resolves once every update settles
   */
  updateAll() {
    const updates = [
      this.updateDelegate(),
      this.updateVoters(),
      this.updateBalance(),
      this.updateStats(),
    ];

    return Promise.all(updates);
  },

  /**
   * Updates forged totals, payout period boundaries, and the aggregate pending rewards shown on the dashboard.
   * @returns {Promise<void>}
   */
  async updateStats() {
    try {
      const delegateForgedInfoResponse = await adamantApiClient.getDelegateStats(config.publicKey);

      if (delegateForgedInfoResponse.success) {
        const {
          forged,
          rewards,
          fees,
        } = delegateForgedInfoResponse;

        this.delegate = {
          ...this.delegate,
          forged: +forged,
          rewards: +rewards,
          fees: +fees,
        };

        const feesInADM = utils.satsToADM(fees);
        const rewardsInADM = utils.satsToADM(rewards);
        const totalADM = utils.satsToADM(forged);

        log.log(
            `Updated forged info for delegate ${config.logName}: ` +
            `total ${totalADM} ADM, ` +
            `block rewards ${rewardsInADM} ADM, ` +
            `fees ${feesInADM} ADM.`,
        );
      } else {
        log.warn(
            `Failed to get forged info for delegate ${config.address}. ` +
            `${delegateForgedInfoResponse.errorMessage}.`,
        );
      }

      const nextRunMoment = payoutCron.cronJob.nextDate();

      this.periodInfo = {
        ...this.periodInfo,
        nextRunMoment,
        nextRunTimestamp: nextRunMoment.valueOf(),
        nextRunDateString: nextRunMoment.toISODate(),
      };

      // Assume the previous run is the most recent saved transaction.
      // Backed by the { timeStamp: -1 } index, so this reads one document instead of the whole collection.
      const [lastTransaction] = await mongo.transactionsCollection
          .find({})
          .sort({ timeStamp: -1 })
          .limit(1)
          .toArray();

      if (lastTransaction) {
        const previousRunTimestamp = lastTransaction.timeStamp;

        this.periodInfo = {
          ...this.periodInfo,
          previousRunTimestamp,
          previousRunEpochtime: utils.epochTime(previousRunTimestamp),
        };
      }

      const periodBlocks = await mongo.blocksCollection.find(
          {
            timestamp: {
              $gte: this.periodInfo.previousRunEpochtime,
            },
          },
      ).toArray();

      if (periodBlocks) {
        const totalForgedSats = periodBlocks.reduce((sum, block) => sum + (+block.totalForged), 0);
        const totalForgedADM = totalForgedSats / SAT;
        const userRewardsADM = periodBlocks.reduce((sum, block) => (
          sum + (block.rewardsADM ? +block.rewardsADM : 0)
        ), 0);

        this.periodInfo = {
          ...this.periodInfo,
          totalForgedSats,
          totalForgedADM,
          userRewardsADM,
          forgedBlocks: periodBlocks.length,
        };
      }

      const voters = await mongo.votersCollection.find({}).toArray();

      this.delegate.pendingRewardsADM = voters.reduce((sum, voter) => sum + normalizePendingReward(voter), 0);
      log.debug(`Updated pending rewards total: ${this.delegate.pendingRewardsADM.toFixed(8)} ADM.`);
    } catch (error) {
      log.error(`Error while updating forging and period stats: ${error}`);
    }
  },

  /**
   * Reads how many delegates a given account currently votes for.
   * @param {string} address ADAMANT address of the voter
   * @returns {Promise<number|undefined>} Number of delegates voted for, or undefined when the lookup fails
   */
  async updateVotes(address) {
    const getVoteDataResponse = await adamantApiClient.getVoteData(address);

    if (getVoteDataResponse.success) {
      return getVoteDataResponse.delegates.length;
    } else {
      log.warn(`Failed to get votes for ${address}. ${getVoteDataResponse.errorMessage}.`);
    }
  },

  /**
   * Refreshes the delegate's voter list and each voter's vote count.
   * @returns {Promise<void>}
   */
  async updateVoters() {
    const getVotersResponse = await adamantApiClient.getVoters(config.publicKey);

    if (getVotersResponse.success) {
      this.delegate.voters = getVotersResponse.accounts;

      for (const voter of this.delegate.voters) {
        voter.votesCount = await this.updateVotes(voter.address);
        await this.updateVoterPublicFields(voter);
      }

      log.log(`Updated voter list for delegate ${config.logName}: ${this.delegate.voters.length} accounts.`);
      log.debug(`Updated vote counts for ${this.delegate.voters.length} voters.`);
    } else {
      log.warn(`Failed to get voters for ${config.address}. ${getVotersResponse.errorMessage}.`);
    }
  },

  /**
   * Saves public voter metadata from the current delegate voter response.
   * @param {object} voter Voter account returned by the ADAMANT node API
   * @returns {Promise<void>}
   */
  async updateVoterPublicFields(voter) {
    if (!utils.isAdmAddress(voter.address)) {
      log.warn('Skipping public voter metadata update for a voter with a missing or malformed address.');
      return;
    }

    try {
      await mongo.votersCollection.updateOne(
          { address: voter.address },
          {
            $set: buildVoterPublicFields(voter),
            $setOnInsert: {
              address: voter.address,
              pending: 0,
              received: 0,
            },
          },
          { upsert: true },
      );
    } catch (error) {
      log.warn(`Failed to update public voter metadata for ${voter.address}: ${error}`);
    }
  },

  /**
   * Refreshes the delegate account data and current balance in sats.
   * @returns {Promise<void>}
   */
  async updateBalance() {
    const getAccountInfoResponse = await adamantApiClient.getAccountInfo({
      publicKey: config.publicKey,
    });

    if (getAccountInfoResponse.success) {
      this.delegate = {
        ...this.delegate,
        ...getAccountInfoResponse.account,
      };

      this.delegate.balance = +this.delegate.balance;

      log.log(`Updated balance for delegate ${config.logName}: ${utils.satsToADM(this.delegate.balance)} ADM.`);
    } else {
      log.warn(`Failed to get account data for ${config.address}. ${getAccountInfoResponse.errorMessage}.`);
    }
  },

  /**
   * Refreshes delegate rank, productivity, and total vote weight.
   * @returns {Promise<object|undefined>} Updated delegate state, or undefined when the lookup fails
   */
  async updateDelegate() {
    const getDelegateResponse = await adamantApiClient.getDelegate({
      publicKey: config.publicKey,
    });

    if (getDelegateResponse.success) {
      const apiDelegate = getDelegateResponse.delegate;

      this.delegate = {
        ...this.delegate,
        ...apiDelegate,
        rank: normalizeDelegateRank(apiDelegate, this.delegate.rank),
      };
      this.delegate.votesWeight = +this.delegate.votesWeight;

      // The account is confirmed to be a delegate here, so it is safe to identify
      // it by name everywhere via config.logName (`'name' (address)`).
      config.poolName = this.delegate.username;
      config.logName = `${formatDelegateName(this.delegate.username)} (${config.address})`;

      const votesWeightInADM = utils.satsToADM(this.delegate.votesWeight);

      log.log(
          `Updated delegate ${config.logName} details: ` +
          `rank ${this.delegate.rank}, ` +
          `productivity ${this.delegate.productivity}%, ` +
          `votesWeight ${votesWeightInADM} ADM.`,
      );

      return this.delegate;
    } else {
      log.warn(`Failed to get delegate for ${config.address}. ${getDelegateResponse.errorMessage}.`);
    }
  },
};

if (process.env.NODE_ENV !== 'test') {
  setInterval(() => store.updateAll(), UPDATE_DELEGATE_INTERVAL);
}

export default store;
