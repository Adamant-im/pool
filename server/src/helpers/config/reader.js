import * as process from 'node:process';
import fs from 'fs';
import jsonminify from 'jsonminify';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import configSchema from './schema.js';
import validateConfig from './validate.js';

import { deriveIdentity, isEncrypted, parseHeader } from '../crypto/passphrase.js';
import secret from '../../modules/secret.js';

import { ADM_ADDRESS_REGEX, EXIT_CODE_ERROR, MIN_PAYOUT } from '../../defines.js';

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

let publicKey;
let address;

// The passPhrase is either a plain phrase (derive the keypair now) or an
// operator-encrypted blob (read the public identity from its header and stay
// LOCKED until `adm-pool unlock`). Detection is deterministic, never heuristic.
if (isEncrypted(config.passPhrase)) {
  try {
    const header = parseHeader(config.passPhrase);
    publicKey = header.publicKey;
    address = header.address;
  } catch (error) {
    exit('Pool\'s config is wrong. Invalid encrypted passPhrase. Cannot start Pool. Error: ', error);
  }

  secret.initEncrypted(config.passPhrase);
} else {
  try {
    ({ publicKey, address } = deriveIdentity(config.passPhrase));
  } catch (error) {
    exit('Pool\'s config is wrong. Invalid passPhrase. Cannot start Pool. Error: ', error);
  }

  secret.initPlain(config.passPhrase, publicKey, address);
}

config.publicKey = publicKey;
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

// Payout destinations are money-moving config. Validate their shape now so a typo
// fails closed at startup instead of sending funds to a malformed address later.
// An empty string is intentional ("keep this share on the pool wallet").
for (const walletField of ['maintenancewallet', 'donatewallet']) {
  const wallet = config[walletField];

  if (wallet && !ADM_ADDRESS_REGEX.test(wallet)) {
    exit(`Pool's ${address} config is wrong. Field _${walletField}_ must be a valid ADM address (U followed by digits). Cannot start Pool.`);
  }
}

// Reward and donation percentages drive payout math; keep each within [0, 100]
// so a negative or out-of-range value cannot distort the maintenance share.
for (const percentField of ['reward_percentage', 'donate_percentage']) {
  const percent = config[percentField];

  if (percent < 0 || percent > 100) {
    exit(`Pool's ${address} config is wrong. Field _${percentField}_ must be between 0 and 100. Cannot start Pool.`);
  }
}

config.poolsShare = 100 - config.reward_percentage - config.donate_percentage;

if (config.poolsShare < 0) {
  exit(`Pool's ${address} config is wrong. reward_percentage + donate_percentage must be <= 100. Cannot start Pool.`);
}

config.payoutperiod = config.payoutperiod[0].toUpperCase() + config.payoutperiod.slice(1).toLowerCase();

// The `adm-pool` CLI imports this module only to resolve config; keep its output clean.
if (!process.env.ADM_POOL_CLI) {
  console.info(`Pool ${address} successfully read config file (${loadedConfigPath ? loadedConfigPath : 'default'}).`);
}

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
