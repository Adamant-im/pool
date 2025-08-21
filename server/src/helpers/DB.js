import * as process from 'node:process';

import { Low, MemorySync } from 'lowdb';
import { JSONFile } from 'lowdb/node';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import syncDB from './sync_db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const createAdapter = (fileName) => (
    process.env.NODE_ENV === 'test' ?
        new MemorySync() :
        new JSONFile(
            join(__dirname, `../../db/${fileName}.json`),
        )
);

export const dbTrans = await syncDB(new Low(
    createAdapter('transactions'),
    { values: [] },
));

export const dbBlocks = await syncDB(new Low(
    createAdapter('blocks'),
    { values: [] },
));

export const dbVoters = await syncDB(new Low(
    createAdapter('voters'),
    { values: [] },
), 60 * 1000 * 60);
