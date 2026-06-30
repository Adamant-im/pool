import { MongoClient } from 'mongodb';
import { config } from '../../helpers/index.js';

const { uri, dbName } = config.mongodb;

const client = new MongoClient(uri);

await client.connect();
const db = client.db(dbName);

// Unique indexes keep block parsing and reward accounting idempotent.
await db.collection('blocks').createIndex({ id: 1 }, { unique: true });
await db.collection('voters').createIndex({ address: 1 }, { unique: true });

// Range scan over the current payout period in store.updateStats().
await db.collection('blocks').createIndex({ timestamp: 1 });
// Latest payout lookup (sort by timeStamp desc, limit 1) in store.updateStats().
await db.collection('transactions').createIndex({ timeStamp: -1 });

/**
 * MongoDB collections used by the pool.
 *
 * Unique indexes on `blocks.id` and `voters.address` keep block parsing and
 * reward accounting idempotent, so duplicate inserts are rejected rather than
 * double-counted. Secondary indexes on `blocks.timestamp` and
 * `transactions.timeStamp` back the period range scan and latest-payout lookup
 * in `store.updateStats()`.
 *
 * @type {{blocksCollection: import('mongodb').Collection, transactionsCollection: import('mongodb').Collection, votersCollection: import('mongodb').Collection}}
 */
export default {
    blocksCollection: db.collection('blocks'),
    transactionsCollection: db.collection('transactions'),
    votersCollection: db.collection('voters'),
};
