import { MongoClient } from 'mongodb';
import { config } from '../../helpers/index.js';

const { uri, dbName } = config.mongodb;

const client = new MongoClient(uri);

await client.connect();
const db = client.db(dbName);

await db.collection('blocks').createIndex({ id: 1 }, { unique: true });
await db.collection('voters').createIndex({ address: 1 }, { unique: true });

export default {
    blocksCollection: db.collection('blocks'),
    transactionsCollection: db.collection('transactions'),
    votersCollection: db.collection('voters'),
};
