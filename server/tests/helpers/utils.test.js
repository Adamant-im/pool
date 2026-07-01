import utils from '../../src/helpers/utils.js';

describe('utils.isAdmAddress', () => {
  it('should accept a well-formed ADM address', () => {
    expect(utils.isAdmAddress('U123456789012345678')).toBe(true);
    // Minimum length accepted by the adamant-api validator: U + 6 digits.
    expect(utils.isAdmAddress('U123456')).toBe(true);
  });

  it('should reject malformed address strings', () => {
    expect(utils.isAdmAddress('')).toBe(false);
    // Too short: the SDK requires at least six digits, so these would fail at sendTokens().
    expect(utils.isAdmAddress('U1')).toBe(false);
    expect(utils.isAdmAddress('U12345')).toBe(false);
    expect(utils.isAdmAddress('123456789')).toBe(false);
    expect(utils.isAdmAddress('u123456')).toBe(false);
    expect(utils.isAdmAddress('U12a345')).toBe(false);
    expect(utils.isAdmAddress('U123456 OR 1=1')).toBe(false);
  });

  it('should reject non-string values that could become query operators', () => {
    expect(utils.isAdmAddress({ $ne: null })).toBe(false);
    expect(utils.isAdmAddress(['U123456'])).toBe(false);
    expect(utils.isAdmAddress(123456)).toBe(false);
    expect(utils.isAdmAddress(null)).toBe(false);
    expect(utils.isAdmAddress(undefined)).toBe(false);
  });
});
