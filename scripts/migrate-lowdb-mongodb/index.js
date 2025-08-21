import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { MongoClient } from 'mongodb';

/**
 * Usage sample:
 *  MONGODB_URI=mongodb://localhost:27017 LOWDB_STORAGE_PATH=../../server/db node index.js
 */

const collectionNames = [
    'blocks',
    'voters',
    'transactions',
];

async function main() {
    const { MONGODB_URI: mongodbUri, LOWDB_STORAGE_PATH: lowdbStoragePath } = process.env;

    const client = new MongoClient(mongodbUri);
    await client.connect();

    for (const collectionName of collectionNames) {
        await migrateData(client, lowdbStoragePath, collectionName);
    }

    await client.close();
}

async function migrateData(mongoClient, lowdbStoragePath, collectionName) {
    const db = new Low(new JSONFile(`${lowdbStoragePath}/${collectionName}.json`), {});
    await db.read();

    const collection = mongoClient.db('adamant-pool').collection(collectionName);

    if (db.data.values && db.data.values.length > 0) {
        await collection.insertMany(db.data.values);
        console.log(`Data of ${collectionName} collection migrated successfully`);
    }
}

await main().catch(console.error);
