import { EventEmitter } from 'node:events';

import { decrypt, parseHeader } from '../helpers/crypto/passphrase.js';

/**
 * Runtime store for the pool's passphrase and its lock state.
 *
 * Two modes:
 * - `plain`: the config holds a plain passphrase; the pool is always unlocked.
 * - `encrypted`: the config holds an encrypted blob; the pool boots LOCKED and
 *   the passphrase only exists in memory after a successful {@link unlock}.
 *
 * The passphrase is never written to disk or logs. On restart it must be supplied again.
 * Emits an `unlock` event so callers (e.g. payout catch-up) can react.
 */
class Secret extends EventEmitter {
  constructor() {
    super();

    this.mode = 'plain';
    this.locked = false;
    this.publicKey = null;
    this.address = null;

    this._passphrase = null;
    this._blob = null;
  }

  /**
   * Initializes the store for a plain (unencrypted) passphrase.
   * @param {string} passphrase Plain ADAMANT passphrase
   * @param {string} publicKey Derived public key (hex)
   * @param {string} address Derived ADM address
   * @returns {void}
   */
  initPlain(passphrase, publicKey, address) {
    this.mode = 'plain';
    this.locked = false;
    this.publicKey = publicKey;
    this.address = address;
    this._passphrase = passphrase;
    this._blob = null;
  }

  /**
   * Initializes the store for an encrypted passphrase, starting in the LOCKED state.
   * @param {string} blob Encrypted passphrase blob
   * @returns {void}
   * @throws {Error} When the blob is malformed
   */
  initEncrypted(blob) {
    const header = parseHeader(blob);

    this.mode = 'encrypted';
    this.locked = true;
    this.publicKey = header.publicKey;
    this.address = header.address;
    this._passphrase = null;
    this._blob = blob;
  }

  /**
   * Whether the passphrase is available for signing (payouts and ADM notifications).
   * @returns {boolean} True when a passphrase is loaded in memory
   */
  isUnlocked() {
    return !this.locked && Boolean(this._passphrase);
  }

  /**
   * Returns the passphrase when unlocked, otherwise null.
   * @returns {string|null} Passphrase available for signing, or null when locked
   */
  getPassphrase() {
    return this.isUnlocked() ? this._passphrase : null;
  }

  /**
   * Decrypts and loads the passphrase with the operator password (encrypted mode only).
   * @param {string} password Operator password
   * @returns {{address: string}} The unlocked pool's address
   * @throws {Error} When already unlocked, not in encrypted mode, or the password is wrong
   */
  unlock(password) {
    if (this.mode !== 'encrypted') {
      throw new Error('Pool passphrase is not encrypted; nothing to unlock.');
    }
    if (this.isUnlocked()) {
      throw new Error('Pool is already unlocked.');
    }

    const { passphrase, publicKey, address } = decrypt(this._blob, password);

    this._passphrase = passphrase;
    this.publicKey = publicKey;
    this.address = address;
    this.locked = false;

    this.emit('unlock', { address });

    return { address };
  }

  /**
   * Clears the decrypted passphrase from memory (encrypted mode only).
   * @returns {void}
   * @throws {Error} When the pool runs with a plain passphrase
   */
  lock() {
    if (this.mode !== 'encrypted') {
      throw new Error('Pool passphrase is not encrypted; it cannot be locked.');
    }

    this._passphrase = null;
    this.locked = true;

    this.emit('lock', { address: this.address });
  }

  /**
   * Returns a secret-free snapshot of the current lock state.
   * @returns {{mode: string, locked: boolean, unlocked: boolean, publicKey: string|null, address: string|null}}
   */
  status() {
    return {
      mode: this.mode,
      locked: this.locked,
      unlocked: this.isUnlocked(),
      publicKey: this.publicKey,
      address: this.address,
    };
  }
}

const secret = new Secret();

export default secret;
