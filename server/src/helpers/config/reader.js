import * as process from 'node:process';
import { createAddressFromPublicKey, createKeypairFromPassphrase } from 'adamant-api';
import fs from 'fs';
import jsonminify from 'jsonminify';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import configSchema from './schema.js';
import validateConfig from './validate.js';

import { EXIT_CODE_ERROR, MIN_PAYOUT } from '../../defines.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { version } = JSON.parse(
    fs.readFileSync(join(__dirname, '../../../../package.json'), 'utf-8'),
);

const getFullConfigPath = (configPath) => (
  join(__dirname, '../../../../', configPath)
);

/**
 * Loads and parses a JSONC config file relative to the repository root.
 * @param {string} configPath Config path relative to the repository root
 * @returns {object} Parsed configuration object
 */
const loadConfig = (configPath) => {
  return JSON.parse(jsonminify(
      fs.readFileSync(getFullConfigPath(configPath), 'utf-8'),
  ));
};

let config = loadConfig('config.default.jsonc');

const configPaths = [
  './config.test.jsonc',
  './config.jsonc',
  './config.json',
];

let loadedConfigPath;

for (const configPath of configPaths) {
  if (fs.existsSync(getFullConfigPath(configPath))) {
    try {
      const loadedConfig = loadConfig(configPath);

      config = {
        ...config,
        ...loadedConfig,
      };

      loadedConfigPath = configPath;

      break;
    } catch (error) {
      exit(`Cannot parse or read config file ${configPath}. Error:`, error);
    }
  }
}

config.version = version;

if (!config.node_ADM) {
  exit('Pool\'s config is wrong. ADM nodes are not set. Cannot start Pool.');
}

if (!config.passPhrase) {
  exit('Pool\'s config is wrong. No passPhrase. Cannot start Pool.');
}

let keysPair;

try {
  keysPair = createKeypairFromPassphrase(config.passPhrase);
} catch (error) {
  exit('Pool\'s config is wrong. Invalid passPhrase. Cannot start Pool. Error: ', error);
}

const address = createAddressFromPublicKey(keysPair.publicKey);

config.publicKey = keysPair.publicKey.toString('hex');
config.address = address;

// Until the delegate is fetched, identify the pool by address only — the account
// may not be a delegate yet. store.updateDelegate() upgrades this to `'name' (address)`.
config.logName = address;

const errorMessage = validateConfig(config, configSchema);

if (errorMessage) {
  exit(errorMessage);
}

if (config.minpayout < MIN_PAYOUT) {
  exit(`Pool's ${address} config is wrong. Parameter minpayout cannot be lower than ${MIN_PAYOUT} ADM. Cannot start Pool.`);
}

config.poolsShare = 100 - config.reward_percentage - config.donate_percentage;

if (config.poolsShare < 0) {
  exit(`Pool's ${address} config is wrong. reward_percentage + donate_percentage must be <= 100. Cannot start Pool.`);
}

config.payoutperiod = config.payoutperiod[0].toUpperCase() + config.payoutperiod.slice(1).toLowerCase();

console.info(`Pool ${address} successfully read config file (${loadedConfigPath ? loadedConfigPath : 'default'}).`);

/**
 * Logs fatal config errors and terminates the process.
 * @param {...unknown} errorMessages Error message parts to print
 * @returns {never}
 */
function exit(...errorMessages) {
  console.error(...errorMessages);
  process.exit(EXIT_CODE_ERROR);
}

export default config;
