import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { MongoClient } from 'mongodb';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Usage sample:
 *  MONGODB_URI=mongodb://localhost:27017 MONGODB_DB=adamant-pool LOWDB_STORAGE_PATH=../../server/db node index.js
 *
 * By default only the most recent blocks are migrated (the full block archive is
 * not used by the running pool, which only scans blocks of the current payout
 * period). Override with BLOCKS_MIGRATION_LIMIT:
 *  BLOCKS_MIGRATION_LIMIT=500 node index.js   # keep the 500 most recent blocks
 *  BLOCKS_MIGRATION_LIMIT=0   node index.js   # migrate the full block archive
 * Voters and transactions are always migrated in full.
 */

const collectionNames = ['blocks', 'voters', 'transactions'];
const uniqueKeysByCollection = {
  blocks: 'id',
  voters: 'address',
  transactions: 'transactionId'
};

// Default number of most recent blocks to migrate. The pool only reads blocks of
// the current payout period, so older blocks add nothing once migrated.
const DEFAULT_BLOCKS_LIMIT = 100;

/**
 * Runs the LowDB to MongoDB migration using environment configuration.
 * @param {object} [options] Dependency overrides for tests
 * @param {Record<string, string | undefined>} [options.env] Environment values to read
 * @param {typeof MongoClient} [options.MongoClientClass] MongoDB client constructor
 * @param {{log: Function}} [options.logger] Logger used for progress output
 * @returns {Promise<void>}
 */
async function main({ env = process.env, logger = console, MongoClientClass = MongoClient } = {}) {
  const {
    MONGODB_URI: mongodbUri,
    MONGODB_DB: mongodbDbName,
    LOWDB_STORAGE_PATH: lowdbStoragePath
  } = env;

  if (!mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  if (!lowdbStoragePath) {
    throw new Error('LOWDB_STORAGE_PATH is required');
  }

  const client = new MongoClientClass(mongodbUri);

  try {
    await client.connect();
    const database = client.db(resolveDatabaseName(mongodbUri, mongodbDbName));

    await ensureIndexes(database);

    const blocksLimit = parseBlocksLimit(env);

    for (const collectionName of collectionNames) {
      // Only the block archive is capped; voters and transactions migrate in full.
      const limit = collectionName === 'blocks' ? blocksLimit : 0;

      await migrateData(database, lowdbStoragePath, collectionName, { logger, limit });
    }
  } finally {
    await client.close();
  }
}

/**
 * Resolves the target MongoDB database name from explicit configuration or the URI path.
 * @param {string} mongodbUri MongoDB connection URI supplied through MONGODB_URI
 * @param {string | undefined} configuredDatabaseName Database name supplied through MONGODB_DB
 * @returns {string} Database name to pass to MongoClient.db()
 * @throws {Error} When neither MONGODB_DB nor the URI path contains a database name
 */
function resolveDatabaseName(mongodbUri, configuredDatabaseName) {
  if (configuredDatabaseName) {
    return configuredDatabaseName;
  }

  // MongoDB lets the default database live in the URI path, for example /adamant-pool.
  const uriDatabaseName = new URL(mongodbUri).pathname.replace(/^\//, '');

  if (uriDatabaseName) {
    return uriDatabaseName;
  }

  throw new Error('MONGODB_DB is required when MONGODB_URI does not include a database name');
}

/**
 * Resolves how many of the most recent blocks to migrate from the environment.
 * Returns {@link DEFAULT_BLOCKS_LIMIT} when unset or invalid, and `0` (meaning
 * "no limit, migrate the full archive") only when explicitly set to a
 * non-negative integer such as `0`.
 * @param {Record<string, string | undefined>} [env] Environment values to read
 * @returns {number} Maximum number of blocks to migrate, where 0 means unlimited
 */
function parseBlocksLimit(env = process.env) {
  const raw = env.BLOCKS_MIGRATION_LIMIT;

  if (raw === undefined || raw === '') {
    return DEFAULT_BLOCKS_LIMIT;
  }

  const value = Number(raw);

  if (Number.isInteger(value) && value >= 0) {
    return value;
  }

  return DEFAULT_BLOCKS_LIMIT;
}

/**
 * Reads a block's height as a sortable number, treating a missing or non-numeric
 * height as the oldest possible block so it is dropped first when capping.
 * @param {object} block LowDB block document
 * @returns {number} Numeric block height, or -Infinity when unavailable
 */
function blockHeight(block) {
  const height = Number(block.height);

  return Number.isFinite(height) ? height : -Infinity;
}

/**
 * Selects the most recent documents up to a limit, ordered by block height.
 * A falsy limit (e.g. `0`) or a limit that covers every document returns the
 * input unchanged, so the full set is migrated.
 * @param {object[]} documents LowDB documents read from a collection file
 * @param {number} limit Maximum documents to keep, where 0 means unlimited
 * @returns {object[]} The documents to migrate
 */
function selectRecentDocuments(documents, limit) {
  if (!limit || documents.length <= limit) {
    return documents;
  }

  return [...documents]
    .sort((first, second) => blockHeight(second) - blockHeight(first))
    .slice(0, limit);
}

/**
 * Builds an idempotent upsert filter for a migrated LowDB document.
 * @param {string} collectionName Name of the MongoDB collection being migrated
 * @param {object} document LowDB document read from the collection JSON file
 * @returns {object | undefined} MongoDB filter based on the collection's unique key, or undefined when the document cannot be matched safely
 */
function getUniqueFilter(collectionName, document) {
  const uniqueKey = uniqueKeysByCollection[collectionName];

  if (!document[uniqueKey]) {
    return;
  }

  return { [uniqueKey]: document[uniqueKey] };
}

/**
 * Creates indexes required for safe reruns of the migration script.
 * @param {import('mongodb').Db} database Target MongoDB database
 * @returns {Promise<void>}
 */
async function ensureIndexes(database) {
  await database.collection('blocks').createIndex({ id: 1 }, { unique: true });
  await database.collection('voters').createIndex({ address: 1 }, { unique: true });
  // Older transaction records can miss transactionId, so keep this unique index sparse.
  await database
    .collection('transactions')
    .createIndex({ transactionId: 1 }, { unique: true, sparse: true });
}

/**
 * Migrates one LowDB collection file into MongoDB with idempotent upserts.
 * @param {import('mongodb').Db} database Target MongoDB database
 * @param {string} lowdbStoragePath Directory containing LowDB JSON files
 * @param {string} collectionName Name of the LowDB and MongoDB collection
 * @param {object} [options] Runtime overrides for tests
 * @param {{log: Function}} [options.logger] Logger used for progress output
 * @param {number} [options.limit] Maximum most-recent documents to migrate, where 0 means unlimited
 * @returns {Promise<void>}
 * @throws {Error} When a document misses the collection's unique key
 */
async function migrateData(
  database,
  lowdbStoragePath,
  collectionName,
  { logger = console, limit = 0 } = {}
) {
  const db = new Low(new JSONFile(`${lowdbStoragePath}/${collectionName}.json`), {});
  await db.read();

  const collection = database.collection(collectionName);
  const values = db.data?.values;

  if (values && values.length > 0) {
    const documents = selectRecentDocuments(values, limit);

    if (documents.length < values.length) {
      logger.log(
        `Keeping the ${documents.length} most recent of ${values.length} ${collectionName}; ` +
          'older records are skipped'
      );
    }

    const operations = documents.map((document) => {
      const filter = getUniqueFilter(collectionName, document);

      if (!filter) {
        throw new Error(`Cannot migrate ${collectionName} document without unique key`);
      }

      return {
        replaceOne: {
          filter,
          replacement: document,
          upsert: true
        }
      };
    });

    // Upserts make the one-time migration safe to rerun after an interrupted attempt.
    await collection.bulkWrite(operations, { ordered: false });
    logger.log(`Data of ${collectionName} collection migrated successfully`);
  }
}

/**
 * Checks whether this module is being executed as the Node.js entrypoint.
 * @param {string | undefined} scriptPath Script path from process.argv[1]
 * @returns {boolean} True when the current module should run as a CLI
 */
function isCliEntrypoint(scriptPath = process.argv[1]) {
  return !!scriptPath && import.meta.url === pathToFileURL(resolve(scriptPath)).href;
}

/**
 * Runs the migration CLI and reports failures with a non-zero process exit code.
 * @param {object} [options] Dependency overrides for tests
 * @param {{error: Function}} [options.logger] Logger used for failure output
 * @param {Function} [options.run] Migration function to execute
 * @returns {Promise<void>}
 */
async function runCli({ logger = console, run = main } = {}) {
  try {
    await run();
  } catch (error) {
    logger.error(error);
    process.exitCode = 1;
  }
}

/* node:coverage ignore next 3 */
if (isCliEntrypoint()) {
  await runCli();
}

export {
  collectionNames,
  DEFAULT_BLOCKS_LIMIT,
  ensureIndexes,
  getUniqueFilter,
  isCliEntrypoint,
  main,
  migrateData,
  parseBlocksLimit,
  resolveDatabaseName,
  runCli,
  selectRecentDocuments,
  uniqueKeysByCollection
};
