import os from 'node:os';
import path from 'node:path';

/**
 * Resolves the Unix domain socket path used by the `adm-pool` control CLI to
 * talk to a running pool. A `controlSocket` config value takes precedence;
 * otherwise the path is derived from the pool's port so multiple pools on one
 * host do not collide.
 * @param {object} config Loaded pool configuration
 * @returns {string} Absolute path to the control socket
 */
export function resolveControlSocketPath(config) {
  if (config.controlSocket) {
    return config.controlSocket;
  }

  return path.join(os.tmpdir(), `adamant-pool-${config.port}-control.sock`);
}
