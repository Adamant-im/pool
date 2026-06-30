import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { buildHealth } from '../modules/health.js';
import config from '../helpers/config/reader.js';
import log from '../helpers/log.js';
import { resolveControlSocketPath } from '../helpers/control/socketPath.js';
import secret from '../modules/secret.js';

/**
 * Handles a single control command from the `adm-pool` CLI.
 *
 * The control channel is a local Unix domain socket with owner-only (`0600`)
 * permissions; the operator password is only ever read here, never logged.
 * @param {{cmd: string, password?: string}} message Parsed control request
 * @returns {object} JSON-serializable response
 */
function handleCommand(message) {
  const { cmd, password } = message;

  switch (cmd) {
    case 'status':
      return { ok: true, health: buildHealth() };

    case 'unlock': {
      if (!password) {
        return { ok: false, error: 'Operator password is required.' };
      }

      try {
        const { address } = secret.unlock(password);

        log.info(`Pool ${address} unlocked via control socket. Payouts and ADM notifications enabled.`);

        return { ok: true, message: `Pool unlocked for ${address}.`, health: buildHealth() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }

    case 'lock': {
      try {
        secret.lock();

        log.log('Pool locked via control socket. Decrypted passphrase cleared from memory.');

        return { ok: true, message: 'Pool locked. Decrypted passphrase cleared from memory.', health: buildHealth() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }

    default:
      return { ok: false, error: `Unknown command: ${cmd}` };
  }
}

/**
 * Starts the local control socket that backs `adm-pool unlock`, `lock`, and `status`.
 *
 * Requests and responses are newline-delimited JSON. The default socket lives in
 * a private per-user directory; a stale socket file is removed first, and the
 * socket is chmod'd to `0600`.
 * @returns {{server: import('node:net').Server, socketPath: string}} The control server and its socket path
 * @throws {Error} When the default runtime directory cannot be created or protected
 */
export function startControlServer() {
  const socketPath = resolveControlSocketPath(config);

  // For the default path, place the socket in a private per-user runtime
  // directory and fail closed if it cannot be protected, so a local attacker
  // cannot pre-create the predictable socket path or read the socket. A custom
  // `controlSocket` is trusted to the operator's chosen location.
  if (!config.controlSocket) {
    prepareRuntimeDir(path.dirname(socketPath));
  }

  try {
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  } catch (error) {
    log.warn(`Failed to remove stale control socket ${socketPath}: ${error.message}.`);
  }

  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      let newlineIndex;

      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) {
          continue;
        }

        let response;

        try {
          response = handleCommand(JSON.parse(line));
        } catch {
          response = { ok: false, error: 'Malformed control request.' };
        }

        socket.write(`${JSON.stringify(response)}\n`);
      }
    });

    // The CLI hangs up as soon as it has the response; ignore the reset.
    socket.on('error', () => {});
  });

  server.on('error', (error) => {
    log.error(`Pool control socket error: ${error.message}.`);
  });

  server.listen(socketPath, () => {
    try {
      fs.chmodSync(socketPath, 0o600);
    } catch (error) {
      // Fail closed: an unprotected unlock socket is worse than no socket.
      log.error(`Failed to protect control socket ${socketPath}: ${error.message}. Shutting it down.`);

      server.close();

      try {
        fs.unlinkSync(socketPath);
      } catch {
        // Nothing to clean up.
      }

      return;
    }

    log.log(`Pool control socket listening at ${socketPath}.`);
  });

  const cleanup = () => {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Socket already gone; nothing to clean up.
    }
  };

  process.once('exit', cleanup);

  return { server, socketPath };
}

/**
 * Creates the per-user runtime directory for the default control socket and
 * verifies it is owner-only. Fails closed when the directory exists but is owned
 * by another user, so an attacker cannot plant a writable directory.
 * @param {string} dir Runtime directory path
 * @returns {void}
 * @throws {Error} When the directory is owned by another user
 */
function prepareRuntimeDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const stats = fs.statSync(dir);

  if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) {
    throw new Error(`Control socket directory ${dir} is not owned by the current user.`);
  }

  // Enforce owner-only access even if the directory already existed with looser permissions.
  fs.chmodSync(dir, 0o700);
}
