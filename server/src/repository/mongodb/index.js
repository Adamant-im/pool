import { MongoClient } from 'mongodb';
import { config } from '../../helpers/index.js';

const { uri, dbName } = config.mongodb;

const client = new MongoClient(uri);

await client.connect();
const db = client.db(dbName);

await db.collection('blocks').createIndex({ id: 1 }, { unique: true });
await db.collection('voters').createIndex({ address: 1 }, { unique: true });

/**
 * MongoDB collections used by the pool.
 *
 * Unique indexes on `blocks.id` and `voters.address` keep block parsing and
 * reward accounting idempotent, so duplicate inserts are rejected rather than
 * double-counted.
 *
 * @type {{blocksCollection: import('mongodb').Collection, transactionsCollection: import('mongodb').Collection, votersCollection: import('mongodb').Collection}}
 */
export default {
    blocksCollection: db.collection('blocks'),
    transactionsCollection: db.collection('transactions'),
    votersCollection: db.collection('voters'),
};
