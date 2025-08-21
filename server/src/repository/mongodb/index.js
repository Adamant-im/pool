import { MongoClient } from 'mongodb';

// TODO: move to config
const uri = 'mongodb://localhost:27017';
const dbname = 'adamant-pool';

const client = new MongoClient(uri);

await client.connect();
const db = client.db(dbname);

export default {
    blocksCollection: db.collection('blocks'),
    transactionsCollection: db.collection('transactions'),
    votersCollection: db.collection('voters'),
};
