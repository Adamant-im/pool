import fs from 'node:fs';
import net from 'node:net';

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

        log.log(`Pool ${address} unlocked via control socket. Payouts and ADM notifications enabled.`);

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
 * Requests and responses are newline-delimited JSON. A stale socket file from a
 * previous run is removed first, and the socket is chmod'd to `0600`.
 * @returns {{server: import('node:net').Server, socketPath: string}} The control server and its socket path
 */
export function startControlServer() {
  const socketPath = resolveControlSocketPath(config);

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
      log.warn(`Failed to set permissions on control socket ${socketPath}: ${error.message}.`);
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
