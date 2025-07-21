import {AdamantApi} from 'adamant-api';

import config from './config/reader.js';
import log from './log.js';

const api = new AdamantApi({
  nodes: config.node_ADM,
  logLevel: config.log_level,
  logger: log,
});

export default api;
