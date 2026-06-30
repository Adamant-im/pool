import { CronJob } from 'cron';
import Payer from '../modules/pay_out.js';
import config from '../helpers/config/reader.js';
import log from '../helpers/log.js';

const payer = new Payer();

// sec(optional) min(0-59) hours(0-23) d_mon(1-31) mon(1-12/names) d_week(0-7/names)
const PATTERNS = {
  '1h': '0 * * * *',
  '1d': '0 0 * * *',
  '5d': '0 0 */5 * *',
  '10d': '0 0 */10 * *',
  '15d': '0 0 */15 * *',
  '30d': '0 0 1 * *',
};
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default {
  cronJob: {},
  init(payoutPeriod) {
    try {
      let cronTime;
      if (DAYS_OF_WEEK.includes(payoutPeriod)) {
        cronTime = `0 0 * * ${payoutPeriod}`;
      } else {
        cronTime = PATTERNS[payoutPeriod];
      }
      if (!cronTime) {
        throw new Error('Invalid cronTime');
      }

      this.cronJob = CronJob.from({
        cronTime,
        onTick: payer.payOut.bind(payer),
        start: false,
        name: 'payout',
      });

      this.cronJob.start();

      log.info('Payout cron job has been started.');
    } catch (error) {
      log.error(
          `Pool's ${config.address} config is wrong. Failed to validate payoutperiod: `+
          `${payoutPeriod}${error ? ', ' + error : ''}. Cannot start Pool.`,
      );

      throw error;
    }
  },
};

