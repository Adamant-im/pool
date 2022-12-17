import {api, utils, config, log} from '../helpers/index.js';
import {dbVoters, dbTrans, dbBlocks} from '../helpers/DB.js';
import {UPDATE_DELEGATE_INTERVAL, SAT} from '../helpers/const.js';

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

  async updateStats() {
    try {
      const delegateForgedInfo = await api.get('delegates/forging/getForgedByAccount', {
        generatorPublicKey: config.publicKey,
      });

      if (delegateForgedInfo.success) {
        const {
          forged,
          rewards,
          fees,
        } = delegateForgedInfo.data;

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
            `Updated forged info for delegate ${this.delegate.username}: ` +
            `total ${totalADM} ADM, ` +
            `block rewards ${rewardsInADM} ADM, ` +
            `fees ${feesInADM} ADM.`,
        );
      } else {
        log.warn(
            `Failed to get forged info for delegate for ${config.address}. ` +
            `${delegateForgedInfo.errorMessage}.`,
        );
      }

      const cron = (await import('../helpers/cron.js')).default.payoutCronJob;

      const nextRunMoment = cron.nextDate();

      this.periodInfo = {
        ...this.periodInfo,
        nextRunMoment,
        nextRunTimestamp: nextRunMoment.valueOf(),
        nextRunDateString: nextRunMoment.toISODate(),
      };

      const transactions = await dbTrans.find({});

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

      const periodBlocks = await dbBlocks.find(({timestamp}) => (
        timestamp > this.periodInfo.previousRunEpochtime
      ));

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

      const voters = await dbVoters.find({});

      this.delegate.pendingRewardsADM = voters.reduce((sum, voter) => sum + voter.pending, 0);
    } catch (error) {
      log.error(`Error while updating forging and period stats: ${error}`);
    }
  },

  async updateVotes(address) {
    const votes = await api.get('accounts/delegates', {
      address,
    });

    if (votes.success) {
      const votesCount = votes.data.delegates.length;

      return votesCount;
    } else {
      log.warn(`Failed to get votes for ${address}. ${votes.errorMessage}.`);
    }
  },

  async updateVoters() {
    const voters = await api.get('delegates/voters', {
      publicKey: config.publicKey,
    });

    if (voters.success) {
      this.delegate.voters = voters.data.accounts;

      for (const voter of this.delegate.voters) {
        voter.votesCount = await this.updateVotes(voter.address);
      }

      log.log(`Updated voters: ${this.delegate.voters.length} accounts`);
    } else {
      log.warn(`Failed to get voters for ${config.address}. ${voters.errorMessage}.`);
    }
  },

  async updateBalance() {
    const account = await api.get('accounts', {
      publicKey: config.publicKey,
    });

    if (account.success) {
      this.delegate = {
        ...this.delegate,
        ...account.data.account,
      };

      this.delegate.balance = +this.delegate.balance;

      log.log(`Updated balance: ${utils.satsToADM(this.delegate.balance)} ADM`);
    } else {
      log.warn(`Failed to get account data for ${config.address}. ${account.errorMessage}.`);
    }
  },

  async updateDelegate() {
    const delegate = await api.get('delegates/get', {
      publicKey: config.publicKey,
    });

    if (delegate.success) {
      this.delegate = {
        ...this.delegate,
        ...delegate.data.delegate,
      };
      this.delegate.votesWeight = +this.delegate.votesWeight;

      const votesWeightInADM = utils.satsToADM(this.delegate.votesWeight);

      log.log(
          `Updated delegate ${this.delegate.username}: ` +
          `rank ${this.delegate.rank}, ` +
          `productivity ${this.delegate.productivity}%, ` +
          `votesWeight ${votesWeightInADM} ADM`,
      );

      return this.delegate;
    } else {
      log.warn(`Failed to get delegate for ${config.address}. ${delegate.errorMessage}.`);
    }
  },
};

if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    store.updateDelegate();
    store.updateVoters();
    store.updateBalance();
    store.updateStats();
  }, UPDATE_DELEGATE_INTERVAL);
}

export default store;
