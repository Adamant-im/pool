import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { createAddressFromPublicKey, createKeypairFromPassphrase } from 'adamant-api';

/**
 * Self-describing prefix that marks an encrypted passphrase blob.
 * Detection is deterministic: a value is encrypted if and only if it starts with this prefix.
 */
export const ENCRYPTED_PREFIX = 'admpool-enc-v1.';

/**
 * scrypt key-derivation parameters. `N` is the CPU/memory cost (2^15),
 * `keylen` is 32 bytes for AES-256. `maxmem` is raised so Node allows the chosen cost.
 */
const KDF = {
  name: 'scrypt',
  N: 1 << 15,
  r: 8,
  p: 1,
  keylen: 32,
  maxmem: 96 * 1024 * 1024,
};

const CIPHER = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Reports whether a config value is an encrypted passphrase blob.
 * Detection is deterministic (prefix match), never a heuristic on length or charset.
 * @param {unknown} value Config value to test
 * @returns {boolean} True when the value is an encrypted passphrase blob
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Derives the public key (hex) and ADM address for a plain passphrase.
 * @param {string} passphrase Plain ADAMANT passphrase
 * @returns {{publicKey: string, address: string}} Derived public key and address
 */
export function deriveIdentity(passphrase) {
  const keysPair = createKeypairFromPassphrase(passphrase);
  const publicKey = keysPair.publicKey.toString('hex');
  const address = createAddressFromPublicKey(keysPair.publicKey);

  return { publicKey, address };
}

/**
 * Derives a 32-byte AES key from the operator password and salt via scrypt.
 * @param {string} password Operator password
 * @param {Buffer} salt KDF salt
 * @returns {Buffer} 32-byte symmetric key
 */
function deriveKey(password, salt) {
  return scryptSync(password, salt, KDF.keylen, {
    N: KDF.N,
    r: KDF.r,
    p: KDF.p,
    maxmem: KDF.maxmem,
  });
}

/**
 * Encrypts a plain passphrase with an operator password.
 *
 * The result is a single self-describing string: the {@link ENCRYPTED_PREFIX}
 * followed by base64url-encoded JSON containing the KDF parameters, salt, IV,
 * auth tag, ciphertext, and the (non-secret) derived public key and address so
 * the pool can run read-only operations while still locked.
 * @param {string} passphrase Plain ADAMANT passphrase to encrypt
 * @param {string} password Operator password used to derive the encryption key
 * @returns {string} Encrypted passphrase blob
 * @throws {Error} When the passphrase or password is empty, or the passphrase is invalid
 */
export function encrypt(passphrase, password) {
  if (!passphrase) {
    throw new Error('Passphrase is required.');
  }
  if (!password) {
    throw new Error('Operator password is required.');
  }

  // Fails fast on an invalid passphrase and gives us the public identity to embed.
  const { publicKey, address } = deriveIdentity(passphrase);

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = createCipheriv(CIPHER, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(passphrase, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const header = {
    kdf: KDF.name,
    N: KDF.N,
    r: KDF.r,
    p: KDF.p,
    cipher: CIPHER,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64'),
    publicKey,
    address,
  };

  const encoded = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');

  return `${ENCRYPTED_PREFIX}${encoded}`;
}

/**
 * Parses the non-secret header of an encrypted passphrase blob without decrypting it.
 * @param {string} blob Encrypted passphrase blob
 * @returns {{publicKey: string, address: string, kdf: string, cipher: string}} Public metadata
 * @throws {Error} When the value is not a valid encrypted passphrase blob
 */
export function parseHeader(blob) {
  if (!isEncrypted(blob)) {
    throw new Error('Value is not an encrypted passphrase blob.');
  }

  let header;

  try {
    const encoded = blob.slice(ENCRYPTED_PREFIX.length);
    header = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Encrypted passphrase blob is malformed.');
  }

  if (!header.publicKey || !header.address || !header.ct) {
    throw new Error('Encrypted passphrase blob is missing required fields.');
  }

  return header;
}

/**
 * Decrypts an encrypted passphrase blob with the operator password.
 *
 * The decrypted passphrase is verified against the public key embedded in the
 * blob header, so a tampered blob or a wrong-but-valid passphrase is rejected.
 * @param {string} blob Encrypted passphrase blob
 * @param {string} password Operator password used during encryption
 * @returns {{passphrase: string, publicKey: string, address: string}} Decrypted passphrase and identity
 * @throws {Error} When the password is wrong or the blob is tampered/malformed
 */
export function decrypt(blob, password) {
  if (!password) {
    throw new Error('Operator password is required.');
  }

  const header = parseHeader(blob);

  const salt = Buffer.from(header.salt, 'base64');
  const iv = Buffer.from(header.iv, 'base64');
  const tag = Buffer.from(header.tag, 'base64');
  const ciphertext = Buffer.from(header.ct, 'base64');

  const key = scryptSync(password, salt, KDF.keylen, {
    N: header.N ?? KDF.N,
    r: header.r ?? KDF.r,
    p: header.p ?? KDF.p,
    maxmem: KDF.maxmem,
  });

  let passphrase;

  try {
    const decipher = createDecipheriv(header.cipher ?? CIPHER, key, iv);
    decipher.setAuthTag(tag);

    passphrase = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // GCM auth failure: wrong password or tampered ciphertext.
    throw new Error('Wrong operator password or corrupted encrypted passphrase.');
  }

  const derived = deriveIdentity(passphrase);

  const expected = Buffer.from(header.publicKey, 'hex');
  const actual = Buffer.from(derived.publicKey, 'hex');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Decrypted passphrase does not match the embedded public key.');
  }

  return { passphrase, publicKey: derived.publicKey, address: derived.address };
}
