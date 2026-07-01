import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
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
} from './index.js';

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'index.js');

class FakeCollection {
  constructor(name) {
    this.name = name;
    this.bulkWrites = [];
    this.indexes = [];
  }

  async bulkWrite(operations, options) {
    this.bulkWrites.push({ operations, options });
  }

  async createIndex(index, options) {
    this.indexes.push({ index, options });
  }
}

class FakeDatabase {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new FakeCollection(name));
    }

    return this.collections.get(name);
  }
}

class FakeMongoClient {
  static instances = [];

  constructor(uri) {
    this.uri = uri;
    this.connected = false;
    this.closed = false;
    this.databases = new Map();
    this.dbNames = [];

    FakeMongoClient.instances.push(this);
  }

  async connect() {
    this.connected = true;
  }

  db(name) {
    this.dbNames.push(name);

    if (!this.databases.has(name)) {
      this.databases.set(name, new FakeDatabase());
    }

    return this.databases.get(name);
  }

  async close() {
    this.closed = true;
  }
}

const noopLogger = {
  log() {}
};

test('collection metadata matches migrated collections', () => {
  assert.deepEqual(collectionNames, ['blocks', 'voters', 'transactions']);
  assert.deepEqual(uniqueKeysByCollection, {
    blocks: 'id',
    voters: 'address',
    transactions: 'transactionId'
  });
});

test('resolveDatabaseName prefers MONGODB_DB over URI database', () => {
  assert.equal(resolveDatabaseName('mongodb://localhost:27017/from-uri', 'from-env'), 'from-env');
});

test('resolveDatabaseName falls back to URI database', () => {
  assert.equal(
    resolveDatabaseName('mongodb://localhost:27017/adamant-pool?authSource=admin'),
    'adamant-pool'
  );
});

test('resolveDatabaseName rejects URIs without a database name', () => {
  assert.throws(() => resolveDatabaseName('mongodb://localhost:27017'), /MONGODB_DB is required/);
});

test('getUniqueFilter returns collection-specific filters', () => {
  assert.deepEqual(getUniqueFilter('blocks', { id: 'block-id' }), { id: 'block-id' });
  assert.deepEqual(getUniqueFilter('voters', { address: 'U123' }), { address: 'U123' });
  assert.deepEqual(getUniqueFilter('transactions', { transactionId: 'tx-id' }), {
    transactionId: 'tx-id'
  });
});

test('getUniqueFilter returns undefined when a safe key is missing', () => {
  assert.equal(getUniqueFilter('blocks', { height: 1 }), undefined);
});

test('ensureIndexes creates unique indexes for migrated collections', async () => {
  const database = new FakeDatabase();

  await ensureIndexes(database);

  assert.deepEqual(database.collection('blocks').indexes, [
    { index: { id: 1 }, options: { unique: true } }
  ]);
  assert.deepEqual(database.collection('voters').indexes, [
    { index: { address: 1 }, options: { unique: true } }
  ]);
  assert.deepEqual(database.collection('transactions').indexes, [
    { index: { transactionId: 1 }, options: { unique: true, sparse: true } }
  ]);
});

test('parseBlocksLimit defaults to DEFAULT_BLOCKS_LIMIT when unset or invalid', () => {
  assert.equal(parseBlocksLimit(), DEFAULT_BLOCKS_LIMIT);
  assert.equal(parseBlocksLimit({}), DEFAULT_BLOCKS_LIMIT);
  assert.equal(parseBlocksLimit({ BLOCKS_MIGRATION_LIMIT: '' }), DEFAULT_BLOCKS_LIMIT);
  assert.equal(parseBlocksLimit({ BLOCKS_MIGRATION_LIMIT: 'abc' }), DEFAULT_BLOCKS_LIMIT);
  assert.equal(parseBlocksLimit({ BLOCKS_MIGRATION_LIMIT: '-5' }), DEFAULT_BLOCKS_LIMIT);
});

test('parseBlocksLimit reads a non-negative integer, where 0 means unlimited', () => {
  assert.equal(parseBlocksLimit({ BLOCKS_MIGRATION_LIMIT: '50' }), 50);
  assert.equal(parseBlocksLimit({ BLOCKS_MIGRATION_LIMIT: '0' }), 0);
});

test('selectRecentDocuments returns the input unchanged when unlimited or within the limit', () => {
  const documents = [{ height: 1 }, { height: 2 }];

  assert.equal(selectRecentDocuments(documents, 0), documents);
  assert.equal(selectRecentDocuments(documents, 5), documents);
});

test('selectRecentDocuments keeps the highest-height documents, oldest dropped first', () => {
  const documents = [
    { id: 'a', height: 1 },
    { id: 'b', height: 3 },
    { id: 'c' } // missing height sorts oldest and is dropped first
  ];

  const kept = selectRecentDocuments(documents, 2);

  assert.deepEqual(
    kept.map((document) => document.id),
    ['b', 'a']
  );
});

test('migrateData caps blocks to the most recent and logs the truncation', async () => {
  const logs = [];
  const logger = { log: (message) => logs.push(message) };
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    blocks: [
      { id: 'b1', height: 1 },
      { id: 'b2', height: 2 },
      { id: 'b3', height: 3 }
    ]
  });
  const database = new FakeDatabase();

  try {
    await migrateData(database, lowdbStoragePath, 'blocks', { logger, limit: 2 });

    const [{ operations }] = database.collection('blocks').bulkWrites;

    assert.deepEqual(
      operations.map((operation) => operation.replaceOne.filter.id),
      ['b3', 'b2']
    );
    assert.ok(logs.some((message) => message.includes('Keeping the 2 most recent of 3 blocks')));
  } finally {
    await cleanup();
  }
});

test('migrateData skips empty LowDB collections', async () => {
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    blocks: []
  });
  const database = new FakeDatabase();

  try {
    await migrateData(database, lowdbStoragePath, 'blocks', { logger: noopLogger });

    assert.deepEqual(database.collection('blocks').bulkWrites, []);
  } finally {
    await cleanup();
  }
});

test('migrateData writes idempotent unordered upserts', async () => {
  const block = { id: 'block-1', height: 10 };
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    blocks: [block]
  });
  const database = new FakeDatabase();

  try {
    await migrateData(database, lowdbStoragePath, 'blocks', { logger: noopLogger });

    assert.deepEqual(database.collection('blocks').bulkWrites, [
      {
        operations: [
          {
            replaceOne: {
              filter: { id: 'block-1' },
              replacement: block,
              upsert: true
            }
          }
        ],
        options: { ordered: false }
      }
    ]);
  } finally {
    await cleanup();
  }
});

test('migrateData rejects documents that cannot be matched safely', async () => {
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    voters: [{ pending: 1 }]
  });
  const database = new FakeDatabase();

  try {
    await assert.rejects(
      () => migrateData(database, lowdbStoragePath, 'voters', { logger: noopLogger }),
      /Cannot migrate voters document without unique key/
    );
  } finally {
    await cleanup();
  }
});

test('main validates required environment variables', async () => {
  await assert.rejects(
    () => main({ env: {}, MongoClientClass: FakeMongoClient, logger: noopLogger }),
    /MONGODB_URI is required/
  );
  await assert.rejects(
    () =>
      main({
        env: { MONGODB_URI: 'mongodb://localhost:27017/adamant-pool' },
        MongoClientClass: FakeMongoClient,
        logger: noopLogger
      }),
    /LOWDB_STORAGE_PATH is required/
  );
});

test('main connects, indexes, migrates every collection, and closes the client', async () => {
  FakeMongoClient.instances = [];
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    blocks: [{ id: 'block-1' }],
    voters: [{ address: 'U123' }],
    transactions: [{ transactionId: 'tx-1' }]
  });

  try {
    await main({
      env: {
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB: 'adamant-pool',
        LOWDB_STORAGE_PATH: lowdbStoragePath
      },
      MongoClientClass: FakeMongoClient,
      logger: noopLogger
    });

    const [client] = FakeMongoClient.instances;
    const database = client.databases.get('adamant-pool');

    assert.equal(client.uri, 'mongodb://localhost:27017');
    assert.equal(client.connected, true);
    assert.equal(client.closed, true);
    assert.deepEqual(client.dbNames, ['adamant-pool']);
    assert.equal(database.collection('blocks').bulkWrites.length, 1);
    assert.equal(database.collection('voters').bulkWrites.length, 1);
    assert.equal(database.collection('transactions').bulkWrites.length, 1);
  } finally {
    await cleanup();
  }
});

test('main closes the MongoDB client when migration fails', async () => {
  FakeMongoClient.instances = [];
  const { path: lowdbStoragePath, cleanup } = await createLowdbStorage({
    blocks: [{ height: 1 }]
  });

  try {
    await assert.rejects(
      () =>
        main({
          env: {
            MONGODB_URI: 'mongodb://localhost:27017/adamant-pool',
            LOWDB_STORAGE_PATH: lowdbStoragePath
          },
          MongoClientClass: FakeMongoClient,
          logger: noopLogger
        }),
      /Cannot migrate blocks document without unique key/
    );

    assert.equal(FakeMongoClient.instances[0].closed, true);
  } finally {
    await cleanup();
  }
});

test('isCliEntrypoint detects the current module path', () => {
  assert.equal(isCliEntrypoint(scriptPath), true);
  assert.equal(isCliEntrypoint(), false);
  assert.equal(isCliEntrypoint(fileURLToPath(import.meta.url)), false);
});

test('runCli leaves exitCode unchanged on success', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    await runCli({ logger: { error() {} }, run: async () => {} });

    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('runCli reports failures with a non-zero exit code', async () => {
  const previousExitCode = process.exitCode;
  const loggedErrors = [];
  const failure = new Error('migration failed');
  process.exitCode = undefined;

  try {
    await runCli({
      logger: {
        error(error) {
          loggedErrors.push(error);
        }
      },
      run: async () => {
        throw failure;
      }
    });

    assert.equal(process.exitCode, 1);
    assert.deepEqual(loggedErrors, [failure]);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('CLI reports configuration failures with a non-zero exit code', () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MONGODB_URI: '',
      MONGODB_DB: '',
      LOWDB_STORAGE_PATH: ''
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGODB_URI is required/);
});

/**
 * Creates a complete temporary LowDB storage directory for migration tests.
 * @param {Record<string, object[]>} collectionData Documents keyed by collection name
 * @returns {Promise<{path: string, cleanup: Function}>} Storage path and cleanup callback
 */
async function createLowdbStorage(collectionData) {
  const path = await mkdtemp(join(tmpdir(), 'pool-migration-'));

  await Promise.all(
    collectionNames.map((collectionName) =>
      writeFile(
        join(path, `${collectionName}.json`),
        `${JSON.stringify({ values: collectionData[collectionName] ?? [] })}\n`
      )
    )
  );

  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true })
  };
}
