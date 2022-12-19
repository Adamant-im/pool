import store from './store.js';

import {notifier, api, config, log} from '../helpers/index.js';
import {dbVoters, dbTrans} from '../helpers/DB.js';
import {
  SAT,
  RETRY_PAYOUTS_TIMEOUT,
  RETRY_PAYOUTS_COUNT,
  FEE,
} from '../helpers/const.js';

class Payer {
  constructor() {
    this.periodInfo = {
      donatePaid: false,
      maintenancePaid: false,
    };

    this.retryNo = 0;
  }

  async payOut() {
    await this.updateVoters();

    const {votersToReward, pendingUserRewards, periodInfo} = this;
    const balance = store.delegate.balance / SAT;

    const infoString = this.getBaseInfoString(balance);

    if (!votersToReward.length) {
      return notifier(`Pool ${config.logName}: No pending payouts.\n${infoString}`, 'warn');
    }

    const {retryNo} = this;
    const nextRetryNo = retryNo + 1;

    if (pendingUserRewards > balance) {
      notifier(
          `Pool ${config.logName}: Unable to do payouts, retryNo: ${retryNo}. ` +
          `Balance of the pool is less, than pending payouts. Top up the pool's balance.\n${infoString}`,
          'error',
      );

      return this.retry();
    }

    notifier(
        retryNo ?
          `Pool ${config.logName}: Re-tying (${nextRetryNo} of ${RETRY_PAYOUTS_COUNT + 1}) to do payouts.` :
          `Pool ${config.logName}: Ready to do periodical payouts.\n${infoString}`,
        'log',
    );

    const {
      payedUserRewards,
      paymentFees,
      payedCount,
      updatedVoters,
      savedTransactions,
    } = await this.payVoters(votersToReward);

    let maintenanceString = '';
    let donateString = '';

    if (payedCount === votersToReward.length) {
      maintenanceString = await this.payToMaintenanceWallet();

      if (config.donatewallet && config.donate_percentage && !periodInfo.donatePaid) {
        donateString = await this.payDonation();
      }
    }

    let payoutInfoString = '';

    const isEveryVoterRewarded = payedCount === votersToReward.length;
    const isEveryRewardSaved = updatedVoters === payedCount && savedTransactions === payedCount;

    const notifyType = isEveryRewardSaved ? 'log' : 'warn';

    payoutInfoString = `I've ${isEveryVoterRewarded ? 'successfully' : ''} payed ${isEveryRewardSaved ? 'and saved ' : ''}`;

    if (isEveryVoterRewarded) {
      if (isEveryRewardSaved) {
        payoutInfoString += 'all ';
      }

      payoutInfoString += (
        `of ${payedCount} payouts, ${payedUserRewards.toFixed(4)} ADM plus ` +
        `${paymentFees.toFixed(1)} ADM fees in total.`
      );

      payoutInfoString += maintenanceString;
      payoutInfoString += donateString;
    } else {
      payoutInfoString += (
        `only ${payedCount} of ${votersToReward.length} payouts, ` +
        `${(payedUserRewards + paymentFees).toFixed(4)} of ${pendingUserRewards.toFixed(4)} ADM.`
      );
    }

    if (!isEveryRewardSaved) {
      payoutInfoString += `\nThere is an issue${!isEveryVoterRewarded ? ' with database also' : ''}.`;

      if (updatedVoters < payedCount) {
        payoutInfoString += ` I've updated only ${updatedVoters} voters.`;
      }
      if (savedTransactions < payedCount) {
        payoutInfoString += ` I've saved only ${savedTransactions} transactions.`;
      }

      payoutInfoString += ` You better do these updates in database manually. Check log file for details.`;
    }

    payoutInfoString += `\nThe pool's balance — ${balance.toFixed(4)} ADM.`;

    if (!isEveryVoterRewarded) {
      const timeoutInMin = ((nextRetryNo * RETRY_PAYOUTS_TIMEOUT) / 1000 / 60).toFixed(1);

      payoutInfoString += `\nI'll re-try to pay the remaining voters in ${timeoutInMin} minutes, retryNo: ${nextRetryNo}.`;
    }

    notifier(`Pool ${config.logName}: ${payoutInfoString}`, notifyType);

    if (isEveryVoterRewarded) {
      this.retryNo = 0;
    } else {
      this.retry();
    }
  }

  async payVoters(voters) {
    let payedUserRewards = 0;
    let payedCount = 0;
    let paymentFees = 0;

    let updatedVoters = 0;
    let savedTransactions = 0;

    for (const voter of voters) {
      try {
        const res = await this.payVoter(voter);

        payedUserRewards += res.amount;
        paymentFees += FEE;
        payedCount += 1;

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

    return {payedUserRewards, paymentFees, payedCount, updatedVoters, savedTransactions};
  }

  async payVoter(voter) {
    let {pending, address, received} = voter;
    const amount = voter.pending - FEE;

    const result = {amount};

    log.log(`Processing payment of ${amount.toFixed(8)} ADM reward to ${address}…`);

    const payment = await api.sendTokens(config.passPhrase, address, amount);

    if (!payment.success) {
      return log.warn(
          `Failed to process payment of ${amount} ADM reward to ${address}. ${payment.errorMessage}.`,
      );
    }

    log.log(`Successfully payed ${amount.toFixed(8)} ADM reward to ${address} with Tx ${payment.data.transactionId}.`);

    received += pending;

    const transaction = {
      ...payment.data,
      address,
      received, // user received in total, including fees
      payoutcount: pending, // user received this time, including Tx fee
      timeStamp: new Date().getTime(),
    };
    delete transaction.success;

    const updateVoter = await dbVoters.update({address}, {
      received, pending: 0,
    });

    if (updateVoter) {
      log.log(
          `Voter's rewards successfully updated after payout: ${received.toFixed(8)} ADM received in total, ` +
          `0 ADM pending for ${address}.`,
      );
      result.isUpdated = true;
    } else {
      log.error(
          `Failed to update rewards for ${address} after successful payout. ` +
          `Do it manually: ${received.toFixed(8)} ADM received in total, 0 ADM pending.`,
      );
    }

    const insertTransaction = await dbTrans.insert(transaction);

    if (insertTransaction) {
      log.log(
          `Successfully saved transaction ${transaction.transactionId} ` +
          `after payout: ${pending.toFixed(8)} ADM payed to ${address}.`,
      );
      result.isTransactionSaved = true;
    } else {
      log.error(
          `Failed to save transaction ${transaction.transactionId} after successful payout. ` +
          `Do it manually: ${pending.toFixed(8)} ADM payed to ${address}.`,
      );
    }

    return result;
  }

  async payToMaintenanceWallet() {
    try {
      const {periodInfo} = this;
      const {totalForgedADM, userRewardsADM} = store.periodInfo;

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

            const paymentMaintenance = await api.sendTokens(
                config.passPhrase,
                config.maintenancewallet,
                maintenanceADM - FEE,
            );

            if (paymentMaintenance.success) {
              periodInfo.maintenancePaid = true;

              log.log(`Successfully payed ${logPayAmount} with Tx ${paymentMaintenance.data.transactionId}.`);
              maintenanceString = `\nSent ${notifyPayAmount}.`;
            } else {
              maintenanceString = `\nUnable to send ${notifyPayAmount}, do it manually. ${paymentMaintenance.errorMessage}.`;
            }
          } else {
            maintenanceString = (
              `\nPool's share ${maintenanceADM.toFixed(4)} ADM ` +
              `(${config.poolsShare.toFixed(2)}%) is less, than Tx fee.`
            );
          }
        }
      } else {
        if (maintenanceADM > 0) {
          maintenanceString = `\nMaintenance wallet is not set. Leaving pool's share of ${notifyPayAmount}.`;
        } else {
          maintenanceString = (
            `\nMaintenance wallet is not set; Pool's share ${maintenanceADM.toFixed(4)} ` +
            `ADM (${config.poolsShare.toFixed(2)}%) is less, than Tx fee.`
          );
        }
      }

      return maintenanceString;
    } catch (error) {
      log.warn(`Error in payToMaintenanceWallet(): ${error}`);

      return '';
    }
  }

  async payDonation() {
    try {
      const {periodInfo} = this;
      const {totalForgedADM} = store.periodInfo;

      const donateADM = (config.donate_percentage * totalForgedADM) / 100;

      const donationAmount = `ADM (${config.donate_percentage.toFixed(2)}%) donation to ${config.donatewallet}`;
      const notifyDonationAmount = `${donateADM.toFixed(4)} ${donationAmount}`;
      const logDonationAmount = `${donateADM.toFixed(8)} ${donationAmount}`;

      let donateString = '';

      if (donateADM - FEE > 0) {
        log.log(`Processing payment of ${logDonationAmount}…`);

        const paymentDonate = await api.sendTokens(
            config.passPhrase,
            config.donatewallet,
            donateADM - FEE,
        );

        if (paymentDonate.success) {
          periodInfo.donatePaid = true;

          log.log(`Successfully payed ${logDonationAmount}.`);

          donateString = `\nSent ${notifyDonationAmount}.`;
        } else {
          donateString = `\nUnable to send ${notifyDonationAmount}, do it manually. ${paymentDonate.errorMessage}.`;
        }
      } else {
        donateString = (
          `\nDonation amount ${donateADM.toFixed(4)} ADM ` +
          `(${config.donate_percentage.toFixed(2)}%) is less, than Tx fee.`
        );
      }

      return donateString;
    } catch (error) {
      log.warn(`Error in payDonation(): ${error}`);

      return '';
    }
  }

  retry() {
    this.retryNo += 1;

    const {retryNo} = this;
    const timeout = retryNo * RETRY_PAYOUTS_TIMEOUT;

    if (this.retryNo > RETRY_PAYOUTS_COUNT) {
      setTimeout(() => {
        notifier(
            `Pool ${config.logName}: After ${RETRY_PAYOUTS_COUNT + 1} tries, ` +
            'I didn\'t finished with payouts. Check the log file.',
            'error',
        );
      }, 1000);
    } else {
      log.log(`Re-trying payouts ${retryNo} time in ${timeout / 1000} seconds.`);

      setTimeout(this.payOut.bind(this), timeout);
    }
  }

  async updateVoters() {
    const voters = await dbVoters.find({});
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

  getBaseInfoString(balance) {
    const {pendingUserRewards, votersToReward, votersBelowMin, belowMinRewards} = this;
    const {totalForgedADM, userRewardsADM, forgedBlocks} = store.periodInfo;

    let infoString = `Pending ${pendingUserRewards.toFixed(4)} ADM rewards for ${votersToReward.length} voters.`;
    infoString += `\n${votersBelowMin.length} voters forged less, than minimum ${config.minpayout} ADM, their pending rewards are ${belowMinRewards.toFixed(4)} ADM.`;
    infoString += `\nThis period the pool forged ${totalForgedADM.toFixed(4)} ADM from ${forgedBlocks} blocks; ${userRewardsADM.toFixed(4)} ADM distributed to users.`;
    infoString += `\nThe pool's balance — ${balance.toFixed(4)} ADM.`;

    return infoString;
  }
}

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

  return {votersToReward, votersBelowMin, pendingUserRewards, belowMinRewards};
}

export default Payer;
