import { AdamantApi } from 'adamant-api';

import config from './config/reader.js';
import log from './log.js';

export default new AdamantApi({
  nodes: config.node_ADM,
  timeout: 10_000,
  maxRetries: 3,
  checkHealthAtStartup: true,
  logLevel: config.log_level,
  logger: log,
});
