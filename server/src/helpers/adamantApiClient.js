import { AdamantApi } from 'adamant-api';

import config from './config/reader.js';
import log from './log.js';

/**
 * Shared ADAMANT API client.
 *
 * Configured with the pool's node list and automatic failover (`maxRetries`),
 * a startup health check, and the pool logger so request diagnostics honor
 * `config.log_level`.
 */
export default new AdamantApi({
  nodes: config.node_ADM,
  timeout: 10_000,
  maxRetries: 3,
  checkHealthAtStartup: true,
  logLevel: config.log_level,
  logger: log,
});
