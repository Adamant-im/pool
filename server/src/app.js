import * as process from 'node:process';

import { api, config, log, notifier } from './helpers/index.js';

import blocksChecker from './modules/blocks_checker.js';
import cron from './helpers/cron.js';
import server from './server/index.js';
import store from './modules/store.js';

log.start();

const cronStatusCode = cron.initCron(config.payoutperiod);

if (cronStatusCode === -1) {
  process.exit(-1);
}

server.listen(config.port, () => (
  log.log(`Pool ${config.address} successfully started a web server.`)
));

if (process.env.NODE_ENV !== 'test') await api.checkNodes();

// Wait for first API health check
api.onReady(async () => {
  await initDelegate();

  blocksChecker();
});

async function initDelegate() {
  const pool = await store.updateDelegate();

  if (pool) {
    config.poolName = pool.username;
  } else {
    log.error(`Failed to get delegate for ${config.address}. Cannot start Pool.`);
    process.exit(-1);
  }

  config.logName = `_${config.poolName}_ (${config.address})`;
  config.infoString = `distributes _${config.reward_percentage}_% rewards to voters` +
    `${config.donate_percentage ? ' and donates ' + config.donate_percentage + '% to ADAMANT Foundation' : ''} ` +
    `with payouts every _${config.payoutperiod}_. Minimum payout is _${config.minpayout}_ ADM.`;

  notifier(
      `Pool ${config.logName} started on v${config.version} software and listens port ${config.port}. It ${config.infoString}`,
      'info',
  );

  await store.updateAll();
}
