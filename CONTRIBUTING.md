# Contributing to ADAMANT Forging Pool

Thank you for improving ADAMANT Forging Pool. Changes should protect payout correctness, reward accounting, pool credentials, decentralized node access, and contributor clarity.

All repository artifacts, including code, comments, documentation, commits, issues, and pull requests, must be written in English.

## Before You Start

- Search [existing issues](https://github.com/Adamant-im/pool/issues) before opening a new one
- Use a concise issue prefix such as `[Bug]`, `[Feat]`, `[Enhancement]`, `[Refactor]`, `[Docs]`, `[Test]`, `[Chore]`, or `[Task]`
- Base work on `dev` and target `dev` in pull requests
- Keep changes focused and reviewable
- Never commit or log pool passphrases, private keys, notification tokens, API credentials, local config contents, or MongoDB credentials

## Development Setup

Use Node.js `22.13.0` or newer and npm `10` or newer:

```sh
git clone https://github.com/Adamant-im/pool.git
cd pool
git switch dev
npm run install:all
```

Create a dedicated branch and keep commits compatible with Conventional Commits:

```sh
git switch -c chore/short-description
```

Copy the public config reference only for local development:

```sh
cp config.default.jsonc config.jsonc
```

Do not commit `config.jsonc`, `config.json`, `config.test.jsonc`, logs, runtime database files, or temporary files from `.ai-ignored/`.

Build the dashboard before launching the pool or when server-only work needs a fresh web bundle:

```sh
npm run build:web
```

## Validation

Choose the smallest focused check while developing, then run the relevant baseline before submitting.

Server changes:

```sh
npm --prefix server run lint
npm --prefix server test
```

Dashboard changes:

```sh
npm --prefix web run lint
npm --prefix web run build
```

Root workflow, documentation, or package changes:

```sh
npm run build:web
npm run format:check
npm audit
git diff --check
```

Dependency changes should also run audits in the affected package roots:

```sh
npm audit
npm --prefix server audit
npm --prefix web audit
npm --prefix scripts/migrate-lowdb-mongodb audit
```

Report the exact commands run and any skipped or blocked validation in the pull request.

## Dependency Updates

- Prefer `ncu` to inspect available direct dependency updates
- Install with lifecycle scripts disabled by default
- Do not enable install scripts globally
- Keep dependency additions minimal, especially around networking, cryptography, config parsing, payout logic, and storage
- Document any trusted rebuild step if a dependency requires one

## Project Structure

- `server/`: backend runtime, ADAMANT API access, config loading and validation, reward distribution, payouts, MongoDB storage, notifications, cron scheduling, and HTTP API
- `web/`: Svelte dashboard for pool status, voters, rewards, and transactions
- `scripts/`: operational and migration helpers
- `config.default.jsonc`: public config reference
- `.ai-ignored/`: local AI workflow notes and temporary GitHub body files

## Reward and Payout Changes

Read the full affected flow before changing:

- `server/src/modules/distribute_rewards.js`
- `server/src/modules/pay_out.js`
- `server/src/modules/store.js`
- `server/src/repository/mongodb/index.js`
- ADAMANT API helpers and config validation

Preserve accounting invariants for pending rewards, received rewards, transaction fees, donation payouts, maintenance payouts, retries, and local storage updates. Add focused tests for payout or reward behavior whenever practical.

## Pull Requests

- Use a title in `Type: Short summary` form, for example `Chore: Modernize pool dependencies`
- Do not use issue-style square-bracket prefixes in PR titles
- Link related issues explicitly, using closing keywords when appropriate
- Explain payout, reward, storage, config, or API behavior changes
- Update documentation when behavior, setup, config, or workflows change
- Include validation commands and meaningful risk notes
- Keep commits small and reviewable; maintainers may squash them when merging
