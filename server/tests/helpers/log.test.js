import config from '../../src/helpers/config/reader.js';
import { jest } from '@jest/globals';

const log = (await import('../../src/helpers/log.js')).default;

describe('log debug level', () => {
  const originalLogLevel = config.log_level;
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    config.log_level = originalLogLevel;
    consoleSpy.mockRestore();
  });

  it('should hide debug messages below debug verbosity', () => {
    config.log_level = 'log';

    log.debug('hidden debug message');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should write debug messages at debug verbosity', () => {
    config.log_level = 'debug';

    log.debug('visible debug message');

    expect(consoleSpy).toHaveBeenCalledWith(
        '\x1b[36m',
        expect.stringContaining('debug|'),
        '\x1b[0m',
        'visible debug message',
    );
  });
});
