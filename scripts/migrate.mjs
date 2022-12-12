import './utils/banner.js';

import * as readline from 'node:readline';
import { existsSync, createReadStream } from 'node:fs';

import path from 'node:path';

import {
  dbTrans,
  dbBlocks,
  dbVoters
} from '../server/src/helpers/DB.js';

let [,, targetPath] = process.argv;

if (!targetPath) {
  console.error('❌ No target database or pool path specified');
  process.exit(0);
}

const dbPath = path.join(targetPath, 'db');

if (existsSync(dbPath)) {
  targetPath = dbPath;
}

console.log(`🔍️ Searching inside "${targetPath}" for DB files to migrate...`);

const dbFiles = [
  {
    fileName: 'blocks',
    dbApi: dbBlocks,
    uniqueKey: 'id'
  },
  {
    fileName: 'transactions',
    dbApi: dbTrans,
    uniqueKey: 'id'
  },
  {
    fileName: 'voters',
    dbApi: dbVoters,
    uniqueKey: 'address'
  }
];

for (const {fileName, dbApi, uniqueKey} of dbFiles) {
  const filePath = path.join(targetPath, fileName);

  if (!existsSync(filePath)) {
    console.warn(`⚠️ The filename "${fileName}" doesn't exist in specified path, skipping.`);
    continue;
  }

  const input = createReadStream(filePath, { encoding: 'utf-8' });

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const valueToMigrate = JSON.parse(line);

    const savedValue = await dbApi.findOne({
      [uniqueKey]: valueToMigrate[uniqueKey]
    });

    if (savedValue) {
      console.log(`⚪️ Value with ${valueToMigrate[uniqueKey]} ${uniqueKey} already exists in ${fileName}, skipping.`);
      continue;
    }

    await dbApi.insert(valueToMigrate);
  }

  rl.close();
}

console.log('✅ The database successfully migrated.');

process.exit(0);
