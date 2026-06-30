import utils from '../../src/helpers/utils.js';

describe('utils.isAdmAddress', () => {
  it('should accept a well-formed ADM address', () => {
    expect(utils.isAdmAddress('U123456789012345678')).toBe(true);
    expect(utils.isAdmAddress('U1')).toBe(true);
  });

  it('should reject malformed address strings', () => {
    expect(utils.isAdmAddress('')).toBe(false);
    expect(utils.isAdmAddress('123456789')).toBe(false);
    expect(utils.isAdmAddress('u123')).toBe(false);
    expect(utils.isAdmAddress('U12a34')).toBe(false);
    expect(utils.isAdmAddress('U123 OR 1=1')).toBe(false);
  });

  it('should reject non-string values that could become query operators', () => {
    expect(utils.isAdmAddress({ $ne: null })).toBe(false);
    expect(utils.isAdmAddress(['U1'])).toBe(false);
    expect(utils.isAdmAddress(123)).toBe(false);
    expect(utils.isAdmAddress(null)).toBe(false);
    expect(utils.isAdmAddress(undefined)).toBe(false);
  });
});
