import * as process from 'node:process';

import { EXIT_CODE_ERROR, UPDATE_BLOCKS_INTERVAL } from './defines.js';
import { adamantApiClient, config, log, notifier } from './helpers/index.js';
import payoutCron from './cron/payout.cron.js';

import store, { formatDelegateName } from './modules/store.js';
import blocksChecker from './modules/blocks_checker.js';
import server from './api/index.js';

log.start();

try {
  payoutCron.init(config.payoutperiod);
} catch {
  process.exit(EXIT_CODE_ERROR);
}

server.listen(config.port, () => (
  log.log(`Pool ${config.address} successfully started the web server.`)
));

// Wait for first API health check
adamantApiClient.onReady(async () => {
  await initDelegate();

  await blocksChecker();
  setInterval(async () => {
    await blocksChecker();
  }, UPDATE_BLOCKS_INTERVAL);
});

/**
 * Loads delegate data before starting block checks and public status notifications.
 * @returns {Promise<void>}
 */
async function initDelegate() {
  const pool = await store.updateDelegate();

  if (pool) {
    config.poolName = pool.username;
  } else {
    log.error(`Failed to get delegate for ${config.address}. Cannot start Pool.`);
    process.exit(EXIT_CODE_ERROR);
  }

  config.logName = `${formatDelegateName(config.poolName)} (${config.address})`;
  config.infoString = `distributes _${config.reward_percentage}_% rewards to voters` +
    `${config.donate_percentage ? ' and donates ' + config.donate_percentage + '% to ADAMANT developer community' : ''} ` +
    `with payouts every _${config.payoutperiod}_. Minimum payout is _${config.minpayout}_ ADM.`;

  notifier(
      `Pool ${config.logName} started on v${config.version} software and web UI running on port ${config.port}. It ${config.infoString}`,
      'info',
  );

  await store.updateAll();
}
