import config from '../helpers/config/reader.js';
import secret from './secret.js';
import store from './store.js';

/**
 * Whether the ADAMANT node connection has completed its startup health check.
 * Flipped to true by app.js once `adamantApiClient.onReady` fires.
 */
let nodeReady = false;

/**
 * Marks the ADAMANT node connection as ready (or not) for health reporting.
 * @param {boolean} ready Node readiness flag
 * @returns {void}
 */
export function setNodeReady(ready) {
  nodeReady = Boolean(ready);
}

/**
 * Builds a secret-free health snapshot of the pool for monitoring (e.g. Zabbix)
 * and for the `adm-pool status` command.
 *
 * `status` is `starting` until the node is ready, `degraded` while the pool is
 * locked (payouts and ADM notifications are paused), and `ok` otherwise.
 * @returns {object} Health snapshot containing no secrets
 */
export function buildHealth() {
  const { mode, locked, address } = secret.status();

  let status = 'ok';

  if (!nodeReady) {
    status = 'starting';
  } else if (locked) {
    status = 'degraded';
  }

  return {
    status,
    version: config.version,
    uptime: Math.floor(process.uptime()),
    address,
    delegate: config.poolName || null,
    payouts: locked ? 'locked' : 'unlocked',
    passphrase: mode === 'encrypted' ? 'encrypted' : 'plain',
    node: {
      ready: nodeReady,
      rank: store.delegate.rank,
      productivity: store.delegate.productivity,
    },
    pendingRewardsADM: store.delegate.pendingRewardsADM,
    lastPayoutTimestamp: store.periodInfo.previousRunTimestamp || null,
    nextPayoutTimestamp: store.periodInfo.nextRunTimestamp || null,
  };
}
