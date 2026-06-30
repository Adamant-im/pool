import validateConfig from '../../src/helpers/config/validate.js';

describe('validateConfig', () => {
  it('should allow configured values listed in allowedValues', () => {
    const config = {
      address: 'U1',
      log_level: 'debug',
    };
    const schema = {
      log_level: {
        type: String,
        allowedValues: ['none', 'error', 'warn', 'info', 'log', 'debug'],
      },
    };

    expect(validateConfig(config, schema)).toBeUndefined();
  });

  it('should reject configured values outside allowedValues', () => {
    const config = {
      address: 'U1',
      log_level: 'trace',
    };
    const schema = {
      log_level: {
        type: String,
        allowedValues: ['none', 'error', 'warn', 'info', 'log', 'debug'],
      },
    };

    expect(validateConfig(config, schema)).toContain('must be one of: none, error, warn, info, log, debug');
  });
});
