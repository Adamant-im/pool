import { CronJob } from 'cron';
import Payer from '../modules/pay_out.js';
import config from '../helpers/config/reader.js';
import log from '../helpers/log.js';
import secret from '../modules/secret.js';

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
  // Set when a scheduled payout fires while the pool is locked, so the deferred
  // run can be processed on `adm-pool unlock` (see runDeferred).
  deferredPayout: false,
  /**
   * Starts the payout cron job for the configured payout period.
   * @param {string} payoutPeriod Payout period: a day name (e.g. `Mon`) or interval key (`1h`, `1d`, `5d`, `10d`, `15d`, `30d`)
   * @returns {void}
   * @throws {Error} When the payout period does not map to a valid cron pattern
   */
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
        onTick: () => this.runScheduled(),
        start: false,
        name: 'payout',
      });

      this.cronJob.start();

      log.info('Payout cron job has been started.');
    } catch (error) {
      log.error(
          `Pool's ${config.address} config is wrong. Failed to validate 'payoutperiod': `+
          `${payoutPeriod}${error ? ', ' + error : ''}. Cannot start Pool.`,
      );

      throw error;
    }
  },

  /**
   * Runs a scheduled payout. When the pool is locked, the run is recorded as
   * deferred (so it can be picked up on unlock) before the payer reports the
   * locked state.
   * @returns {Promise<void>}
   */
  async runScheduled() {
    if (!secret.isUnlocked()) {
      this.deferredPayout = true;
    }

    await payer.payOut();
  },

  /**
   * Processes a payout that was due while the pool was locked. No-op when no
   * scheduled run was missed or the pool is locked again. The deferred marker is
   * cleared only after an attempt actually runs while unlocked, so an immediate
   * re-lock or a payout error does not drop the missed run — a later unlock
   * replays it.
   * @returns {Promise<void>}
   */
  async runDeferred() {
    if (!this.deferredPayout || !secret.isUnlocked()) {
      return;
    }

    log.info('Processing reward payouts that were deferred while the pool was locked.');

    try {
      await payer.payOut();

      // payOut() owns its own retry scheduling for partial failures, so a
      // completed attempt clears the deferred marker.
      this.deferredPayout = false;
    } catch (error) {
      // Keep the marker set so the next unlock retries the missed payout.
      log.error(`Deferred payout attempt failed, keeping it pending for the next unlock: ${error}`);
    }
  },
};

