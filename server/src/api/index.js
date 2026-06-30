import { dirname, join } from 'path';
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'url';

import { buildHealth } from '../modules/health.js';
import config from '../helpers/config/reader.js';
import mongo from '../repository/mongodb/index.js';
import secret from '../modules/secret.js';
import store from '../modules/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../../../web/dist/');

/**
 * Read-only Express app that serves the web dashboard and the public pool JSON API.
 * All routes are GET-only; no endpoint exposes secrets or accepts state changes.
 */
const app = express();

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET'],
}));

app.use(/\.js/, (req, res, next) => {
  res.set('Content-Type', 'text/javascript');
  next();
});

app.use('/', express.static(publicDir));

app.get('/', (req, res) => res.sendFile(join(publicDir, 'index.html')));

// Machine-readable health snapshot for external monitoring (e.g. Zabbix).
// Always HTTP 200 while the web server is up; the operational state lives in
// the `status` field (`ok` | `degraded` | `starting`) and `payouts`
// (`unlocked` | `locked`). A locked pool is intentional, not "down", so it is
// not signalled with a 5xx. Exposes no secrets and accepts no input.
app.get('/api/health', (req, res) => res.send(buildHealth()));

// Returns all recorded payout transactions.
app.get('/api/transactions', async (req, res) => {
  const transactions = await mongo.transactionsCollection.find({}).toArray();

  return res.send(transactions);
});

// Returns all voters with their accumulated and pending rewards.
app.get('/api/voters', async (req, res) => {
  const voters = await mongo.votersCollection.find({}).toArray();

  return res.send(voters);
});

// Returns the in-memory delegate/period state snapshot.
app.get('/api/delegate', async (req, res) => res.send(store));

// Returns the public pool configuration and current period summary.
app.get('/api/config', async (req, res) => res.send({
  version: config.version,
  reward_percentage: config.reward_percentage,
  donate_percentage: config.donate_percentage,
  minpayout: config.minpayout,
  // True while an encrypted passphrase has not been unlocked, so payouts are paused.
  locked: secret.status().locked,
  payoutperiod: config.payoutperiod,
  payoutperiodForged: store.periodInfo.totalForgedADM,
  payoutperiodRewards: store.delegate.pendingRewardsADM,
  payoutperiodPreviousRunTimestamp: store.periodInfo.previousRunTimestamp,
  payoutperiodNextRunTimestamp: store.periodInfo.nextRunTimestamp,
}));

export default app;
