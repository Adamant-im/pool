import express from 'express';
import cors from 'cors';

import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

import store from '../modules/store.js';

import {dbVoters, dbTrans} from '../helpers/DB.js';
import config from '../helpers/config/reader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const publicDir = join(__dirname, '../../../web/dist/');

const app = express();

app.use(cors());

app.use('*.js', (req, res, next) => {
  res.set('Content-Type', 'text/javascript');
  next();
});

app.use('/', express.static(publicDir));

app.get('/', (req, res) => res.sendFile(join(publicDir, 'index.html')));

app.get('/api/get-transactions', async (req, res) => {
  const transactions = await dbTrans.find({});

  return res.send(transactions);
});

app.get('/api/get-voters', async (req, res) => {
  const voters = await dbVoters.find({});

  return res.send(voters);
});

app.get('/api/get-delegate', async (req, res) => res.send(store));

app.get('/api/get-config', async (req, res) => res.send({
  version: config.version,
  reward_percentage: config.reward_percentage,
  donate_percentage: config.donate_percentage,
  minpayout: config.minpayout,
  payoutperiod: config.payoutperiod,
  payoutperiodForged: store.periodInfo.totalForgedADM,
  payoutperiodRewards: store.delegate.pendingRewardsADM,
  payoutperiodPreviousRunTimestamp: store.periodInfo.previousRunTimestamp,
  payoutperiodNextRunTimestamp: store.periodInfo.nextRunTimestamp,
}));

export default app;
