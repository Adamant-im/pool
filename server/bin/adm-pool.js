#!/usr/bin/env node
import net from 'node:net';

import { createHiddenPrompter } from '../src/helpers/prompt.js';
import { encrypt } from '../src/helpers/crypto/passphrase.js';

// Keep config-loading side effects quiet so command output stays clean.
process.env.ADM_POOL_CLI = '1';

const [, , command] = process.argv;

const prompter = createHiddenPrompter();

/**
 * Prints CLI usage.
 * @returns {void}
 */
function printUsage() {
  process.stdout.write([
    'adm-pool — ADAMANT pool control CLI',
    '',
    'Usage:',
    '  adm-pool encrypt   Encrypt a passphrase with an operator password (prints the config value)',
    '  adm-pool unlock    Unlock a running pool (prompts for the operator password)',
    '  adm-pool lock      Re-lock a running pool (clears the decrypted passphrase from memory)',
    '  adm-pool status    Show the running pool status',
    '',
  ].join('\n'));
}

/**
 * Encrypts a passphrase entered interactively and prints the config value.
 * Runs standalone — it needs no running pool and no existing config.
 * @returns {Promise<void>}
 */
async function cmdEncrypt() {
  const passphrase = (await prompter.ask('Enter the pool passphrase to encrypt: ')).trim();

  if (!passphrase) {
    process.stderr.write('Passphrase cannot be empty.\n');
    process.exit(1);
  }

  const password = await prompter.ask('Enter an operator password: ');
  const confirm = await prompter.ask('Confirm the operator password: ');

  if (password !== confirm) {
    process.stderr.write('Operator passwords do not match.\n');
    process.exit(1);
  }

  let blob;

  try {
    blob = encrypt(passphrase, password);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }

  process.stdout.write('\nEncrypted passphrase — set it as "passPhrase" in your pool config:\n\n');
  process.stdout.write(`${blob}\n`);
}

/**
 * Sends a single newline-delimited JSON command to the pool control socket.
 * @param {string} socketPath Control socket path
 * @param {object} payload Command payload
 * @returns {Promise<object>} Parsed response
 */
function sendCommand(socketPath, payload) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath);
    let buffer = '';

    socket.on('connect', () => socket.write(`${JSON.stringify(payload)}\n`));

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      const newlineIndex = buffer.indexOf('\n');

      if (newlineIndex !== -1) {
        socket.end();

        try {
          resolve(JSON.parse(buffer.slice(0, newlineIndex)));
        } catch (error) {
          reject(error);
        }
      }
    });

    socket.on('error', (error) => reject(error));
  });
}

/**
 * Resolves the control socket path from the loaded pool config.
 * @returns {Promise<string>} Control socket path
 */
async function getSocketPath() {
  const { default: config } = await import('../src/helpers/config/reader.js');
  const { resolveControlSocketPath } = await import('../src/helpers/control/socketPath.js');

  return resolveControlSocketPath(config);
}

/**
 * Reports a control-connection error and exits. A missing socket or refused
 * connection means the pool is not running.
 * @param {NodeJS.ErrnoException} error Connection error
 * @param {string} socketPath Control socket path
 * @returns {never}
 */
function reportConnectionError(error, socketPath) {
  if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
    process.stderr.write(`Pool is not running or its control socket was not found at ${socketPath}.\n`);
  } else {
    process.stderr.write(`Control request failed: ${error.message}\n`);
  }

  process.exit(1);
}

/**
 * Verifies the pool is running by connecting to its control socket.
 * @param {string} socketPath Control socket path
 * @returns {Promise<void>} Resolves when the socket accepts a connection
 */
function ensureReachable(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath);

    socket.on('connect', () => {
      socket.end();
      resolve();
    });

    socket.on('error', (error) => reject(error));
  });
}

/**
 * Runs a control command against a running pool, prompting for the password when needed.
 * @param {'unlock'|'lock'|'status'} cmd Control command
 * @param {{needsPassword?: boolean}} [options] Command options
 * @returns {Promise<void>}
 */
async function cmdSocket(cmd, { needsPassword = false } = {}) {
  const socketPath = await getSocketPath();

  // Check the pool is up before prompting, so a stopped pool is reported
  // immediately rather than after the operator has typed the password.
  if (needsPassword) {
    try {
      await ensureReachable(socketPath);
    } catch (error) {
      reportConnectionError(error, socketPath);
    }
  }

  const payload = { cmd };

  if (needsPassword) {
    payload.password = await prompter.ask('Enter the operator password: ');
  }

  let response;

  try {
    response = await sendCommand(socketPath, payload);
  } catch (error) {
    reportConnectionError(error, socketPath);
  }

  if (!response.ok) {
    process.stderr.write(`${response.error}\n`);
    process.exit(1);
  }

  if (cmd === 'status') {
    printStatus(response.health);
  } else {
    process.stdout.write(`${response.message}\n`);
  }
}

/**
 * Prints a pool health snapshot in a human-readable form.
 * @param {object} health Health snapshot from the pool
 * @returns {void}
 */
function printStatus(health) {
  const lines = [
    `Pool:        ${health.delegate ? `${health.delegate} (${health.address})` : health.address}`,
    `Status:      ${health.status}`,
    `Payouts:     ${health.payouts}`,
    `Passphrase:  ${health.passphrase}`,
    `Node ready:  ${health.node.ready}`,
    `Version:     ${health.version}`,
    `Uptime:      ${health.uptime}s`,
  ];

  if (health.nextPayoutTimestamp) {
    lines.push(`Next payout: ${new Date(health.nextPayoutTimestamp).toISOString()}`);
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

/**
 * CLI entry point.
 * @returns {Promise<void>}
 */
async function main() {
  switch (command) {
    case 'encrypt':
      return cmdEncrypt();
    case 'unlock':
      return cmdSocket('unlock', { needsPassword: true });
    case 'lock':
      return cmdSocket('lock');
    case 'status':
      return cmdSocket('status');
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

await main();
