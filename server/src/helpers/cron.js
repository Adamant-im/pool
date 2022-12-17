import cron from 'cron';
import Payer from '../modules/pay_out.js';
import config from './config/reader.js';
import log from './log.js';

const payer = new Payer();

// sec(optional) min(0-59) hours(0-23) d_mon(1-31) mon(1-12/names) d_week(0-7/names)
const patterns = {
  '1h': '0 * * * *',
  '1d': '0 0 * * *',
  '5d': '0 0 */5 * *',
  '10d': '0 0 */10 * *',
  '15d': '0 0 */15 * *',
  '30d': '0 0 1 * *',
};

const daysOfTheWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default {
  payoutCronJob: {},
  initCron(payoutperiod) {
    let pattern;

    if (daysOfTheWeek.includes(payoutperiod)) {
      pattern = `0 0 * * ${payoutperiod}`;
    } else {
      pattern = patterns[payoutperiod];
    }

    if (!pattern) {
      return exit();
    }

    try {
      const payoutCronJob = new cron.CronJob(pattern, payer.payOut.bind(payer));

      payoutCronJob.start();

      this.payoutCronJob = payoutCronJob;
    } catch (e) {
      return exit(e);
    }
  },
};

function exit(additionalInfo) {
  log.error(
      `Pool's ${config.address} config is wrong. Failed to validate payoutperiod: `+
      `${config.payoutperiod}${additionalInfo ? ', ' + additionalInfo : ''}. Cannot start Pool.`,
  );

  return -1;
}
