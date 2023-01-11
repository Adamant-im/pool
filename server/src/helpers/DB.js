import {Low, MemorySync} from 'lowdb';
import {JSONFileSync} from 'lowdb/node';

import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

import syncDB from './sync_db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const createAdapter = (fileName) => (
    process.env.NODE_ENV === 'test' ?
        new MemorySync() :
        new JSONFileSync(
            join(__dirname, `../../db/${fileName}.json`),
        )
);

export const dbTrans = syncDB(new Low(
    createAdapter('transactions'),
));

export const dbBlocks = syncDB(new Low(
    createAdapter('blocks'),
));

export const dbVoters = syncDB(new Low(
    createAdapter('voters'),
), 60 * 1000 * 60);
