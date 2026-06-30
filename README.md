# ADAMANT Forging Pool

ADAMANT Forging Pool calculates delegate voter rewards, sends scheduled payouts, stores reward history in MongoDB, serves a public voter dashboard, and notifies operators about important pool events.

This repository is the maintained successor of the older [`adamant-pool`](https://github.com/Adamant-im/adamant-pool) implementation.

![ADAMANT Forging Pool](./assets/logo.png)

## Features

- Automated reward calculation for delegate voters
- Scheduled ADM payouts with retry handling
- Optional donation and maintenance wallet payouts
- MongoDB-backed block, voter, and transaction history
- Public dashboard for pool status, voter rewards, and transactions
- ADAMANT and Slack notifications for operators
- Decentralized ADAMANT node access with node failover through `adamant-api`
- Migration helpers for older LowDB-based pool data

## Requirements

- Node.js `22.13.0` or newer
- npm `10` or newer
- MongoDB `6` or newer
- An ADAMANT delegate account with enough ADM for payout fees

## Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/Adamant-im/pool.git
cd pool
npm run install:all
```

`npm run install:all` installs root, server, web, and migration-script dependencies with lifecycle scripts disabled. If you install packages manually, prefer:

```sh
npm install --ignore-scripts
npm --prefix server install --ignore-scripts
npm --prefix web install --ignore-scripts
```

Build the dashboard:

```sh
npm run build:web
```

## Configuration

Create a local config file:

```sh
cp config.default.jsonc config.jsonc
```

Edit `config.jsonc` and set at least:

- `passPhrase`: secret phrase of the pool delegate account
- `node_ADM`: ADAMANT node URLs used for blockchain API access
- `mongodb.uri`: MongoDB connection URI
- `mongodb.dbName`: database name for pool storage
- payout parameters such as `reward_percentage`, `minpayout`, and `payoutperiod`

Keep `config.jsonc`, `config.json`, and `config.test.jsonc` local. They may contain pool credentials and notification tokens.

## Launching

Start the pool directly:

```sh
npm start
```

For production, use a process manager such as [`pm2`](https://pm2.keymetrics.io/):

```sh
pm2 start ./scripts/start.sh --name adamantpool
```

## Migrations

### From v2 Pool

To migrate an older v2 pool database, pass the old pool directory or database directory:

```sh
node scripts/migrate.mjs ~/adamant-pool
```

Restart the pool after migration.

### From LowDB to MongoDB

Older v3 development builds stored data in LowDB JSON files. To migrate those files to MongoDB:

```sh
cd scripts/migrate-lowdb-mongodb
npm install --ignore-scripts
MONGODB_URI=mongodb://localhost:27017 MONGODB_DB=adamant-pool LOWDB_STORAGE_PATH=../../server/db node index.js
```

Then set MongoDB connection parameters in `config.jsonc`:

```jsonc
"mongodb": {
  "uri": "mongodb://localhost:27017",
  "dbName": "adamant-pool"
}
```

Restart the pool after migration.

## Development and Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, validation commands, project structure, and pull request rules.

## Links

- [ADAMANT website](https://adamant.im)
- [ADAMANT apps](https://adamant.im/#adm-apps)
- [ADAMANT explorer](https://explorer.adamant.im)
- [ADAMANT Improvement Proposals](https://aips.adamant.im)
- [Forging article](https://medium.com/adamant-im/earning-money-on-adm-forging-4c7b6eb15516)
- [List of ADAMANT pools](https://medium.com/adamant-im/hodl-list-of-adamant-pools-join-in-and-get-rewards-491a98610f4b)
