import {
  ENCRYPTED_PREFIX,
  decrypt,
  deriveIdentity,
  encrypt,
  isEncrypted,
  parseHeader,
} from '../../src/helpers/crypto/passphrase.js';

const PASSPHRASE = 'apple banana cherry dog elephant frog grape house ice juice kite lemon';
const PASSWORD = 'correct horse battery staple';

describe('passphrase crypto', () => {
  describe('isEncrypted', () => {
    it('detects encrypted blobs deterministically by prefix', () => {
      const blob = encrypt(PASSPHRASE, PASSWORD);

      expect(isEncrypted(blob)).toBe(true);
      expect(blob.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    });

    it('treats a plain passphrase as not encrypted', () => {
      expect(isEncrypted(PASSPHRASE)).toBe(false);
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted(123)).toBe(false);
    });
  });

  describe('encrypt/decrypt round trip', () => {
    it('recovers the original passphrase with the right password', () => {
      const blob = encrypt(PASSPHRASE, PASSWORD);
      const result = decrypt(blob, PASSWORD);

      expect(result.passphrase).toBe(PASSPHRASE);
    });

    it('produces a different blob each time (random salt/iv)', () => {
      expect(encrypt(PASSPHRASE, PASSWORD)).not.toBe(encrypt(PASSPHRASE, PASSWORD));
    });

    it('embeds the public identity for locked-mode reads', () => {
      const identity = deriveIdentity(PASSPHRASE);
      const header = parseHeader(encrypt(PASSPHRASE, PASSWORD));

      expect(header.publicKey).toBe(identity.publicKey);
      expect(header.address).toBe(identity.address);
      expect(header.address.startsWith('U')).toBe(true);
    });
  });

  describe('decrypt failures', () => {
    it('rejects a wrong password', () => {
      const blob = encrypt(PASSPHRASE, PASSWORD);

      expect(() => decrypt(blob, 'wrong password')).toThrow(/Wrong operator password/);
    });

    it('rejects a tampered ciphertext', () => {
      const blob = encrypt(PASSPHRASE, PASSWORD);
      const header = parseHeader(blob);

      const tamperedCt = Buffer.from(header.ct, 'base64');
      tamperedCt[0] ^= 0xff;
      header.ct = tamperedCt.toString('base64');

      const tamperedBlob = ENCRYPTED_PREFIX +
        Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');

      expect(() => decrypt(tamperedBlob, PASSWORD)).toThrow();
    });

    it('requires a non-empty passphrase and password to encrypt', () => {
      expect(() => encrypt('', PASSWORD)).toThrow(/Passphrase is required/);
      expect(() => encrypt(PASSPHRASE, '')).toThrow(/Operator password is required/);
    });
  });

  describe('parseHeader', () => {
    it('throws on a non-encrypted value', () => {
      expect(() => parseHeader(PASSPHRASE)).toThrow(/not an encrypted/);
    });

    it('throws on a malformed blob', () => {
      expect(() => parseHeader(`${ENCRYPTED_PREFIX}not-base64-json`)).toThrow();
    });
  });
});
