import {
  FEE,
  RETRY_PAYOUTS_COUNT,
  RETRY_PAYOUTS_TIMEOUT,
  SAT,
} from '../defines.js';
import store from './store.js';

import { adamantApiClient, config, log, notifier } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';

class Payer {
  /**
   * Creates a payout coordinator with per-period donation and maintenance state.
   */
  constructor() {
    this.periodInfo = {
      donatePaid: false,
      maintenancePaid: false,
    };

    this.retryNo = 0;
  }

  /**
   * Runs the payout cycle for voters above the minimum payout threshold.
   * @returns {Promise<void>}
   */
  async payOut() {
    await this.updateVoters();

    const { votersToReward, pendingUserRewards, periodInfo } = this;
    const balance = store.delegate.balance / SAT;

    const infoString = this.getBaseInfoString(balance);

    if (!votersToReward.length) {
      return notifier(`Pool ${config.logName}: No pending payouts.\n${infoString}`, 'warn');
    }

    const { retryNo } = this;
    const nextRetryNo = retryNo + 1;

    if (pendingUserRewards > balance) {
      notifier(
          `Pool ${config.logName}: Unable to do payouts, retryNo: ${retryNo}. ` +
          `The pool balance is lower than pending payouts. Top up the pool balance.\n${infoString}`,
          'error',
      );

      return this.retry();
    }

    notifier(
        retryNo ?
          `Pool ${config.logName}: Retrying payouts (${nextRetryNo} of ${RETRY_PAYOUTS_COUNT + 1}).` :
          `Pool ${config.logName}: Ready to process scheduled payouts.\n${infoString}`,
        'log',
    );

    const {
      paidUserRewards,
      paymentFees,
      paidCount,
      updatedVoters,
      savedTransactions,
    } = await this.payVoters(votersToReward);

    let maintenanceString = '';
    let donateString = '';

    if (paidCount === votersToReward.length) {
      maintenanceString = await this.payToMaintenanceWallet();

      if (config.donatewallet && config.donate_percentage && !periodInfo.donatePaid) {
        donateString = await this.payDonation();
      }
    }

    const isEveryVoterRewarded = paidCount === votersToReward.length;
    const isEveryRewardSaved = updatedVoters === paidCount && savedTransactions === paidCount;

    const notifyType = isEveryRewardSaved ? 'log' : 'warn';

    let payoutInfoString = `I ${isEveryVoterRewarded ? 'successfully ' : ''}paid ${isEveryRewardSaved ? 'and saved ' : ''}`;

    if (isEveryVoterRewarded) {
      if (isEveryRewardSaved) {
        payoutInfoString += 'all ';
      }

      payoutInfoString += (
        `of ${paidCount} payouts, ${paidUserRewards.toFixed(4)} ADM plus ` +
        `${paymentFees.toFixed(1)} ADM fees in total.`
      );
    } else {
      payoutInfoString += (
        `only ${paidCount} of ${votersToReward.length} payouts, ` +
        `${(paidUserRewards + paymentFees).toFixed(4)} of ${pendingUserRewards.toFixed(4)} ADM.`
      );
    }

    if (!isEveryRewardSaved) {
      payoutInfoString += `\nThere is an issue${!isEveryVoterRewarded ? ' with payouts and database updates' : ' with database updates'}.`;

      if (updatedVoters < paidCount) {
        payoutInfoString += ` I've updated only ${updatedVoters} voters.`;
      }
      if (savedTransactions < paidCount) {
        payoutInfoString += ` I've saved only ${savedTransactions} transactions.`;
      }

      payoutInfoString += ' Apply the missing database updates manually. Check the log file for details.';
    }

    payoutInfoString += maintenanceString;
    payoutInfoString += donateString;

    payoutInfoString += `\nThe pool's balance — ${balance.toFixed(4)} ADM.`;

    if (!isEveryVoterRewarded) {
      const timeoutInMin = ((nextRetryNo * RETRY_PAYOUTS_TIMEOUT) / 1000 / 60).toFixed(1);

      payoutInfoString += `\nI will retry the remaining voter payouts in ${timeoutInMin} minutes, retryNo: ${nextRetryNo}.`;
    }

    notifier(`Pool ${config.logName}: ${payoutInfoString}`, notifyType);

    if (isEveryVoterRewarded) {
      this.retryNo = 0;
      this.periodInfo = {
        donatePaid: false,
        maintenancePaid: false,
      };
    } else {
      this.retry();
    }
  }

  /**
   * Pays each eligible voter sequentially and records aggregate payout results.
   * @param {object[]} voters Voter database records with pending rewards
   * @returns {Promise<{paidUserRewards: number, paymentFees: number, paidCount: number, updatedVoters: number, savedTransactions: number}>}
   */
  async payVoters(voters) {
    let paidUserRewards = 0;
    let paidCount = 0;
    let paymentFees = 0;

    let updatedVoters = 0;
    let savedTransactions = 0;

    for (const voter of voters) {
      try {
        const res = await this.payVoter(voter);

        paidUserRewards += res.amount;
        paymentFees += FEE;
        paidCount += 1;

        if (res.isUpdated) {
          updatedVoters += 1;
        }

        if (res.isTransactionSaved) {
          savedTransactions += 1;
        }
      } catch (error) {
        log.error(`Error while doing payouts for ${voter.address}: ${error}`);
      }
    }

    return { paidUserRewards, paymentFees, paidCount, updatedVoters, savedTransactions };
  }

  /**
   * Sends a payout transaction to one voter and saves the voter and transaction records.
   * @param {object} voter Voter database record with address, pending, and received amounts
   * @returns {Promise<{amount: number, isUpdated?: boolean, isTransactionSaved?: boolean}|void>}
   */
  async payVoter(voter) {
    let { pending, address, received } = voter;
    const amount = voter.pending - FEE;

    const result = { amount };

    log.log(`Processing payment of ${amount.toFixed(8)} ADM reward to ${address}…`);

    const payment = await adamantApiClient.sendTokens(config.passPhrase, address, amount);

    if (!payment.success) {
      return log.warn(
          `Failed to process payment of ${amount} ADM reward to ${address}. ${payment.errorMessage}.`,
      );
    }

    log.log(`Successfully paid ${amount.toFixed(8)} ADM reward to ${address} with Tx ${payment.transactionId}.`);

    received += pending;

    const transaction = {
      ...payment,
      address,
      received, // user received in total, including fees
      payoutcount: pending, // user received this time, including Tx fee
      timeStamp: new Date().getTime(),
    };
    delete transaction.success;

    try {
      await mongo.votersCollection.updateOne(
          { address },
          {
            $set: {
              received,
              pending: 0,
            },
          });
    } catch {
      log.error(
          `Failed to update rewards for ${address} after successful payout. ` +
          `Do it manually: ${received.toFixed(8)} ADM received in total, 0 ADM pending.`,
      );
      return;
    }

    log.log(
        `Voter's rewards successfully updated after payout: ${received.toFixed(8)} ADM received in total, ` +
        `0 ADM pending for ${address}.`,
    );
    result.isUpdated = true;

    try {
      await mongo.transactionsCollection.insertOne(transaction);
    } catch {
      log.error(
          `Failed to save transaction ${transaction.transactionId} after successful payout. ` +
          `Do it manually: ${pending.toFixed(8)} ADM paid to ${address}.`,
      );
      return;
    }

    log.log(
        `Successfully saved transaction ${transaction.transactionId} ` +
        `after payout: ${pending.toFixed(8)} ADM paid to ${address}.`,
    );
    result.isTransactionSaved = true;

    return result;
  }

  /**
   * Pays the pool maintenance share after all voter payouts have succeeded.
   * @returns {Promise<string>} Notification text to append to the payout summary
   */
  async payToMaintenanceWallet() {
    try {
      const { periodInfo } = this;
      const { totalForgedADM, userRewardsADM } = store.periodInfo;

      const donateADM = (config.donate_percentage * totalForgedADM) / 100;
      const maintenanceADM = totalForgedADM - userRewardsADM - donateADM;

      const payAmount = `ADM (${config.poolsShare.toFixed(2)}%) pool's share to maintenance wallet ${config.maintenancewallet}`;
      const notifyPayAmount = `${maintenanceADM.toFixed(4)} ${payAmount}`;
      const logPayAmount = `${maintenanceADM.toFixed(8)} ${payAmount}`;

      let maintenanceString = '';

      if (config.maintenancewallet) {
        if (!periodInfo.maintenancePaid) {
          if (maintenanceADM - FEE > 0) {
            log.log(`${logPayAmount}…`);

            const paymentMaintenance = await adamantApiClient.sendTokens(
                config.passPhrase,
                config.maintenancewallet,
                maintenanceADM - FEE,
            );

            if (paymentMaintenance.success) {
              periodInfo.maintenancePaid = true;

              log.log(`Successfully paid ${logPayAmount} with Tx ${paymentMaintenance.transactionId}.`);
              maintenanceString = `\nSent ${notifyPayAmount}.`;
            } else {
              maintenanceString = `\nUnable to send ${notifyPayAmount}, do it manually. ${paymentMaintenance.errorMessage}.`;
            }
          } else {
            maintenanceString = (
              `\nPool's share ${maintenanceADM.toFixed(4)} ADM ` +
              `(${config.poolsShare.toFixed(2)}%) is lower than the Tx fee.`
            );
          }
        }
      } else {
        if (maintenanceADM > 0) {
          maintenanceString = `\nMaintenance wallet is not set. Leaving pool's share of ${notifyPayAmount}.`;
        } else {
          maintenanceString = (
            `\nMaintenance wallet is not set; Pool's share ${maintenanceADM.toFixed(4)} ` +
            `ADM (${config.poolsShare.toFixed(2)}%) is lower than the Tx fee.`
          );
        }
      }

      return maintenanceString;
    } catch (error) {
      log.warn(`Error in payToMaintenanceWallet(): ${error}`);

      return '';
    }
  }

  /**
   * Pays the configured donation share after all voter payouts have succeeded.
   * @returns {Promise<string>} Notification text to append to the payout summary
   */
  async payDonation() {
    try {
      const { periodInfo } = this;
      const { totalForgedADM } = store.periodInfo;

      const donateADM = (config.donate_percentage * totalForgedADM) / 100;

      const donationAmount = `ADM (${config.donate_percentage.toFixed(2)}%) donation to ${config.donatewallet}`;
      const notifyDonationAmount = `${donateADM.toFixed(4)} ${donationAmount}`;
      const logDonationAmount = `${donateADM.toFixed(8)} ${donationAmount}`;

      let donateString = '';

      if (donateADM - FEE > 0) {
        log.log(`Processing payment of ${logDonationAmount}…`);

        const paymentDonate = await adamantApiClient.sendTokens(
            config.passPhrase,
            config.donatewallet,
            donateADM - FEE,
        );

        if (paymentDonate.success) {
          periodInfo.donatePaid = true;

          log.log(`Successfully paid ${logDonationAmount}.`);

          donateString = `\nSent ${notifyDonationAmount}.`;
        } else {
          donateString = `\nUnable to send ${notifyDonationAmount}, do it manually. ${paymentDonate.errorMessage}.`;
        }
      } else {
        donateString = (
          `\nDonation amount ${donateADM.toFixed(4)} ADM ` +
          `(${config.donate_percentage.toFixed(2)}%) is lower than the Tx fee.`
        );
      }

      return donateString;
    } catch (error) {
      log.warn(`Error in payDonation(): ${error}`);

      return '';
    }
  }

  /**
   * Schedules another payout attempt or reports final retry exhaustion.
   * @returns {void}
   */
  retry() {
    this.retryNo += 1;

    const { retryNo } = this;
    const timeout = retryNo * RETRY_PAYOUTS_TIMEOUT;

    if (this.retryNo > RETRY_PAYOUTS_COUNT) {
      setTimeout(() => {
        notifier(
            `Pool ${config.logName}: After ${RETRY_PAYOUTS_COUNT + 1} tries, ` +
            'payouts are still incomplete. Check the log file.',
            'error',
        );
      }, 1000);
    } else {
      log.log(`Retrying payouts attempt ${retryNo} in ${timeout / 1000} seconds.`);

      setTimeout(this.payOut.bind(this), timeout);
    }
  }

  /**
   * Loads voters and payout totals used by the current payout cycle.
   * @returns {Promise<void>}
   */
  async updateVoters() {
    const voters = await mongo.votersCollection.find({}).toArray();
    const {
      votersToReward,
      votersBelowMin,
      pendingUserRewards,
      belowMinRewards,
    } = getVotersRewards(voters);

    this.votersToReward = votersToReward;
    this.votersBelowMin = votersBelowMin;
    this.pendingUserRewards = pendingUserRewards;
    this.belowMinRewards = belowMinRewards;
  }

  /**
   * Builds the base payout summary for notifications.
   * @param {number} balance Current pool account balance in ADM
   * @returns {string} Human-readable payout summary
   */
  getBaseInfoString(balance) {
    const { pendingUserRewards, votersToReward, votersBelowMin, belowMinRewards } = this;
    const { totalForgedADM, userRewardsADM, forgedBlocks } = store.periodInfo;

    let infoString = `Pending ${pendingUserRewards.toFixed(4)} ADM rewards for ${votersToReward.length} voters.`;
    infoString += `\n${votersBelowMin.length} voters have less than the minimum ${config.minpayout} ADM; their pending rewards are ${belowMinRewards.toFixed(4)} ADM.`;
    infoString += `\nThis period the pool forged ${totalForgedADM.toFixed(4)} ADM from ${forgedBlocks} blocks; ${userRewardsADM.toFixed(4)} ADM distributed to users.`;
    infoString += `\nThe pool's balance — ${balance.toFixed(4)} ADM.`;

    return infoString;
  }
}

/**
 * Splits voter records into payable and below-minimum reward groups.
 * @param {object[]} voters Voter records loaded from storage
 * @returns {{votersToReward: object[], votersBelowMin: object[], pendingUserRewards: number, belowMinRewards: number}}
 */
function getVotersRewards(voters) {
  const votersToReward = [];
  const votersBelowMin = [];

  let pendingUserRewards = 0;
  let belowMinRewards = 0;

  voters.forEach((voter) => {
    if (voter.pending >= config.minpayout) {
      votersToReward.push(voter);
      pendingUserRewards += voter.pending;
    } else {
      votersBelowMin.push(voter);
      belowMinRewards += voter.pending;
    }
  });

  return { votersToReward, votersBelowMin, pendingUserRewards, belowMinRewards };
}

export default Payer;
