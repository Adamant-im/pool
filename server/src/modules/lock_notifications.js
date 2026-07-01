import { config, notifier } from '../helpers/index.js';

/**
 * Sends an operator warning when the pool starts locked and waits for unlock.
 * @returns {void}
 */
export function notifyPoolLockedAtStartup() {
  notifier(
      `Pool ${config.logName}: Pool started LOCKED and is waiting for the operator password. ` +
      'Payouts are paused until you run `adm-pool unlock`. Pending rewards are preserved.',
      'warn',
  );
}

/**
 * Sends an operator info notification after the encrypted passphrase is unlocked.
 * @returns {void}
 */
export function notifyPoolUnlocked() {
  notifier(
      `Pool ${config.logName}: Pool unlocked. Payouts are enabled.`,
      'info',
  );
}
