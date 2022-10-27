import adamantApi from 'adamant-api';

import config from './config/reader.js';
import log from './log.js';

const api = adamantApi({
  node: config.node_ADM,
  logLevel: config.log_level,
  checkHealthAtStartup: process.env.NODE_ENV !== 'test',
}, log);

export default api;
