import * as process from 'node:process';
import { SAT, UPDATE_DELEGATE_INTERVAL } from '../defines.js';
import { adamantApiClient, config, log, utils } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';
import payoutCron from '../cron/payout.cron.js';

const DELEGATE_PAGE_LIMIT = 100;

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
 * Checks whether two delegate records describe the same delegate.
 * @param {object} candidate Delegate record from a list response
 * @param {object} target Delegate record returned for the configured pool
 * @returns {boolean} Whether both records match by stable delegate identity fields
 */
function isSameDelegate(candidate, target) {
  return Boolean(
      (candidate.publicKey && target.publicKey && candidate.publicKey === target.publicKey) ||
      (candidate.address && target.address && candidate.address === target.address) ||
      (candidate.username && target.username && candidate.username === target.username),
  );
}

/**
 * Resolves delegate rank from its position in the delegates list.
 * @param {object} delegate Delegate data returned by the single delegate endpoint
 * @param {number} fallbackRank Rank to use when the delegates list cannot be read
 * @param {object} apiClient ADAMANT API client used to read delegates
 * @returns {Promise<number>} Delegate position in the full delegates list
 */
export async function resolveDelegateRank(delegate, fallbackRank = 0, apiClient = adamantApiClient) {
  const fallback = normalizeDelegateRank(delegate, fallbackRank);
  let offset = 0;
  let totalCount;

  do {
    const delegatesResponse = await apiClient.getDelegates({
      limit: DELEGATE_PAGE_LIMIT,
      offset,
    });

    if (!delegatesResponse.success || !Array.isArray(delegatesResponse.delegates)) {
      return fallback;
    }

    const delegateIndex = delegatesResponse.delegates.findIndex((candidate) => (
      isSameDelegate(candidate, delegate)
    ));

    if (delegateIndex !== -1) {
      return offset + delegateIndex + 1;
    }

    const delegatesCount = delegatesResponse.delegates.length;

    if (delegatesCount === 0) {
      return fallback;
    }

    totalCount = Number(delegatesResponse.totalCount);
    offset += delegatesCount;
  } while (!Number.isFinite(totalCount) || offset < totalCount);

  return fallback;
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

  updateAll() {
    const updates = [
      this.updateDelegate(),
      this.updateVoters(),
      this.updateBalance(),
      this.updateStats(),
    ];

    return Promise.all(updates);
  },

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
            `Updated forged info for delegate ${formatDelegateName(this.delegate.username)}: ` +
            `total ${totalADM} ADM, ` +
            `block rewards ${rewardsInADM} ADM, ` +
            `fees ${feesInADM} ADM.`,
        );
      } else {
        log.warn(
            `Failed to get forged info for delegate for ${config.address}. ` +
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

      const transactions = await mongo.transactionsCollection.find({}).toArray();

      // Assume previous run is the last saved transaction
      const lastTransaction = transactions.sort((a, b) => b.timeStamp - a.timeStamp)[0];

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

      this.delegate.pendingRewardsADM = voters.reduce((sum, voter) => sum + voter.pending, 0);
    } catch (error) {
      log.error(`Error while updating forging and period stats: ${error}`);
    }
  },

  async updateVotes(address) {
    const getVoteDataResponse = await adamantApiClient.getVoteData(address);

    if (getVoteDataResponse.success) {
      return getVoteDataResponse.delegates.length;
    } else {
      log.warn(`Failed to get votes for ${address}. ${getVoteDataResponse.errorMessage}.`);
    }
  },

  async updateVoters() {
    const getVotersResponse = await adamantApiClient.getVoters(config.publicKey);

    if (getVotersResponse.success) {
      this.delegate.voters = getVotersResponse.accounts;

      for (const voter of this.delegate.voters) {
        voter.votesCount = await this.updateVotes(voter.address);
      }

      log.log(`Updated voters: ${this.delegate.voters.length} accounts`);
    } else {
      log.warn(`Failed to get voters for ${config.address}. ${getVotersResponse.errorMessage}.`);
    }
  },

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

      log.log(`Updated balance: ${utils.satsToADM(this.delegate.balance)} ADM`);
    } else {
      log.warn(`Failed to get account data for ${config.address}. ${getAccountInfoResponse.errorMessage}.`);
    }
  },

  async updateDelegate() {
    const getDelegateResponse = await adamantApiClient.getDelegate({
      publicKey: config.publicKey,
    });

    if (getDelegateResponse.success) {
      const apiDelegate = getDelegateResponse.delegate;

      this.delegate = {
        ...this.delegate,
        ...apiDelegate,
        rank: await resolveDelegateRank(apiDelegate, this.delegate.rank),
      };
      this.delegate.votesWeight = +this.delegate.votesWeight;

      const votesWeightInADM = utils.satsToADM(this.delegate.votesWeight);

      log.log(
          `Updated delegate ${formatDelegateName(this.delegate.username)}: ` +
          `rank ${this.delegate.rank}, ` +
          `productivity ${this.delegate.productivity}%, ` +
          `votesWeight ${votesWeightInADM} ADM`,
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
