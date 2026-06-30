import * as process from 'node:process';

import { EXIT_CODE_ERROR, UNLOCK_PROMPT_DELAY, UPDATE_BLOCKS_INTERVAL } from './defines.js';
import { adamantApiClient, config, log, notifier } from './helpers/index.js';
import payoutCron from './cron/payout.cron.js';

import blocksChecker from './modules/blocks_checker.js';
import { promptHidden } from './helpers/prompt.js';
import secret from './modules/secret.js';
import server from './api/index.js';
import { setNodeReady } from './modules/health.js';
import { startControlServer } from './api/control.js';
import store from './modules/store.js';

log.start();

try {
  payoutCron.init(config.payoutperiod);
} catch {
  process.exit(EXIT_CODE_ERROR);
}

server.listen(config.port, () => (
  log.log(`Pool ${config.address} successfully started the web server on port ${config.port}.`)
));

// Local control channel backing `adm-pool unlock`, `lock`, and `status`.
const { socketPath } = startControlServer();

if (secret.status().mode === 'plain') {
  log.warn(
      `Pool ${config.address} is using a PLAIN passphrase stored in the config file. ` +
      'For better security, encrypt it with `adm-pool encrypt` and unlock with `adm-pool unlock`.',
  );
}

// When the pool is unlocked, process any payout that fell due during the lock.
secret.on('unlock', () => {
  payoutCron.runDeferred().catch((error) => (
    log.error(`Failed to process deferred payouts after unlock: ${error}`)
  ));
});

// Resolves once the startup unlock prompt has been answered (or skipped). Delegate
// startup waits on this so it cannot exit the process while the operator is still
// typing the password at the interactive prompt.
let markUnlockSettled;
const unlockSettled = new Promise((resolve) => {
  markUnlockSettled = resolve;
});

// Wait for first API health check
adamantApiClient.onReady(async () => {
  setNodeReady(true);

  await unlockSettled;

  await initDelegate();

  await blocksChecker();
  setInterval(async () => {
    await blocksChecker();
  }, UPDATE_BLOCKS_INTERVAL);
});

try {
  await maybeUnlockInteractively();
} finally {
  markUnlockSettled();
}

/**
 * Resolves the locked-passphrase state at startup. In a terminal the operator is
 * prompted for the password; under a service manager (pm2/systemd, no TTY) the
 * pool keeps running LOCKED and waits for `adm-pool unlock` over the control socket.
 * @returns {Promise<void>}
 */
async function maybeUnlockInteractively() {
  if (secret.status().mode !== 'encrypted' || secret.isUnlocked()) {
    return;
  }

  if (!process.stdin.isTTY) {
    log.warn(
        `Pool ${config.address} started LOCKED — the passphrase is encrypted and no terminal is attached. ` +
        `Payouts and ADM notifications are paused. Run \`adm-pool unlock\` (control socket: ${socketPath}).`,
    );

    return;
  }

  // Give the burst of startup logs a moment to flush so the prompt is the last
  // line on screen instead of being buried in concurrent log output.
  await new Promise((resolve) => setTimeout(resolve, UNLOCK_PROMPT_DELAY));

  log.warn('Pool passphrase is encrypted. Enter the operator password to unlock payouts, or press Enter to start LOCKED.');

  const password = await promptHidden('Enter the operator password: ');

  if (!password) {
    log.warn('No password entered. Pool starting LOCKED. Run `adm-pool unlock` to enable payouts.');

    return;
  }

  try {
    secret.unlock(password);

    log.log('Pool unlocked. Payouts and ADM notifications enabled.');
  } catch (error) {
    log.error(`Unlock failed: ${error.message}. Pool starting LOCKED. Run \`adm-pool unlock\` to retry.`);
  }
}

/**
 * Loads delegate data before starting block checks and public status notifications.
 * @returns {Promise<void>}
 */
async function initDelegate() {
  // updateDelegate() sets config.logName/poolName once the account is confirmed to be a delegate.
  const pool = await store.updateDelegate();

  if (!pool) {
    log.error(`Failed to get delegate for ${config.address}. Cannot start Pool.`);
    process.exit(EXIT_CODE_ERROR);
  }

  config.infoString = `distributes _${config.reward_percentage}_% rewards to voters` +
    `${config.donate_percentage ? ' and donates ' + config.donate_percentage + '% to ADAMANT developer community' : ''} ` +
    `with payouts every _${config.payoutperiod}_. Minimum payout is _${config.minpayout}_ ADM.`;

  notifier(
      `Pool ${config.logName} started on v${config.version} software and web UI running on port ${config.port}. It ${config.infoString}`,
      'info',
  );

  await store.updateAll();
}
