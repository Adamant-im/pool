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
- Optional operator-password-encrypted passphrase with an `adm-pool` control CLI
- `GET /api/health` endpoint for external monitoring (e.g. Zabbix)
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

## Securing the passphrase

The `passPhrase` accepts two forms:

- A **plain passphrase** — simplest, but stored in clear text in the config (kept for compatibility, not recommended).
- An **operator-encrypted passphrase** — the passphrase is encrypted with an operator password and decrypted only in memory at runtime. A leaked config no longer exposes the pool's forging key.

The `adm-pool` control CLI manages encryption and the runtime lock state:

```sh
npm run adm-pool encrypt   # prompts for the passphrase and an operator password, prints the encrypted value
npm run adm-pool unlock    # prompts for the operator password and unlocks a running pool
npm run adm-pool lock      # clears the decrypted passphrase from the running pool's memory
npm run adm-pool status    # shows the running pool's status
```

Workflow:

1. Run `npm run adm-pool encrypt` and paste the resulting `admpool-enc-v1....` string into `config.jsonc` as `passPhrase`.
2. Start the pool. With an encrypted passphrase it boots **LOCKED**: block sync, the web dashboard, and the public API all work, but **payouts and ADM notifications are paused** until you unlock it.
   - In a **terminal** (`npm start`), the pool prompts for the operator password on startup.
   - Under **pm2 / systemd** (no terminal), the pool keeps running locked and waits — unlock it from another shell with `npm run adm-pool unlock`.
3. A payout that falls due while the pool is locked is **deferred**, not lost: pending rewards remain in the database and are processed as soon as you unlock.

The CLI talks to the running pool over a local Unix socket (owner-only `0600` permissions). Override its path with the `controlSocket` config value when running several pools on one host.

## Monitoring

`GET /api/health` returns a secret-free JSON snapshot for external monitoring such as Zabbix:

```jsonc
{
  "status": "ok", // ok | degraded (locked) | starting
  "version": "3.1.0",
  "uptime": 12345,
  "address": "U1234...",
  "payouts": "unlocked", // unlocked | locked
  "passphrase": "encrypted",
  "node": { "ready": true, "rank": 12, "productivity": 99.5 },
  "nextPayoutTimestamp": 1750086400000
}
```

The endpoint always responds with HTTP `200` while the web server is up; a locked pool is intentional, not down, so it is reported as `"status": "degraded"` / `"payouts": "locked"` rather than a `5xx`. Alert on `.status != "ok"` or `.payouts == "locked"`.

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
