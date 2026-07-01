import os from 'node:os';
import path from 'node:path';

/**
 * Returns the private per-user runtime directory that holds the default control
 * socket. Scoping the directory to the current user (and creating it `0700` in
 * the server) keeps the default socket out of the shared, world-writable system
 * temp root, so a local attacker cannot pre-create the predictable socket path.
 * @returns {string} Per-user runtime directory path
 */
export function controlSocketDir() {
  const userId = typeof process.getuid === 'function' ? process.getuid() : os.userInfo().username;

  return path.join(os.tmpdir(), `adamant-pool-${userId}`);
}

/**
 * Resolves the Unix domain socket path used by the `adm-pool` control CLI to
 * talk to a running pool. A `controlSocket` config value takes precedence;
 * otherwise the path is derived from the pool's port inside the private per-user
 * runtime directory so multiple pools on one host do not collide.
 * @param {object} config Loaded pool configuration
 * @returns {string} Absolute path to the control socket
 */
export function resolveControlSocketPath(config) {
  if (config.controlSocket) {
    return config.controlSocket;
  }

  return path.join(controlSocketDir(), `control-${config.port}.sock`);
}
