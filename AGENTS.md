# ADAMANT Forging Pool: AI Agent Operating Manual

This document defines how AI agents should work in this repository.

## Mission

ADAMANT Forging Pool calculates and transfers delegate voter rewards, serves a voter dashboard, stores local reward history, and sends admin notifications.

Agent output must optimize for:

- Correct reward and payout behavior
- Secret safety for pool credentials, notification tokens, and local config
- Reliability under node outages and partial API failures
- Decentralized node access and operator self-hostability
- Open-source maintainability and contributor clarity

If tradeoffs are required, preserve payout safety and secret safety first.

## Language Policy

- Developers may communicate with AI in any language
- All repository artifacts must be in English only
- Write code, comments, docs, issue text, PR text, commit messages, and release notes in English

## Writing Style

- Prefer concise, operational wording over marketing language
- In JSDoc param descriptions, bullet lists, and numbered lists, do not add a trailing period when an item contains one sentence
- If an item contains two or more sentences, end every sentence with a period
- Keep Markdown lists surrounded by blank lines and use fenced code blocks with language tags when practical

## JSDoc Policy

- Write JSDoc for functions you add or materially change
- Document each function's purpose, parameters, and return value when the return shape is not trivially obvious
- Add `@param` entries for all parameters and describe meaningful value semantics, not only types
- Reuse existing typedefs when available instead of inventing ad hoc inline object descriptions
- Keep JSDoc aligned with current behavior and update it in the same patch when behavior changes

## Sources of Truth

Use these sources when implementing or reviewing changes:

- Current repository code and passing tests
- `README.md`, `CONTRIBUTING.md`, and `config.default.jsonc`
- Root `package.json`, `server/package.json`, and `web/package.json`
- ADAMANT docs: <https://docs.adamant.im>
- ADAMANT Node and API schema references: <https://github.com/Adamant-im/adamant> and <https://schema.adamant.im>
- AIPs: <https://aips.adamant.im> and <https://github.com/Adamant-im/AIPs>
- Organization-wide issue, PR, and label governance: <https://github.com/Adamant-im/.github>
- Recommended issue title prefixes: <https://github.com/orgs/Adamant-im/discussions/5>
- Recommended labels for issues and discussions: <https://github.com/orgs/Adamant-im/discussions/1>

If sources disagree, treat current code and tests as the implementation truth for current behavior, then document the drift and propose a synchronized fix.

## GitHub Workflow

Follow ADAMANT organization conventions:

- Search existing issues before creating a new one
- Prefer organization issue forms when they are available
- Use concise issue title prefixes, with one or two prefixes maximum
- Use labels from the organization label catalog, not ad hoc names
- Target PRs to `dev`, not `master`
- Link related issues and PRs explicitly, using closing keywords when appropriate
- Use temporary Markdown files in `.ai-ignored/` for multi-line CLI input such as issue bodies, PR bodies, and commit messages

Issue prefixes:

- `[Bug]` for bugs, crashes, and unexpected behavior
- `[Feat]` for new functionality
- `[Enhancement]` for improvements without a brand new feature
- `[Refactor]` for refactoring without intended behavior changes
- `[Docs]` for documentation work
- `[Test]` for test additions or test improvements
- `[Chore]` for maintenance, tooling, dependencies, or CI work
- `[Task]` for general tasks
- `[Composite]` for multi-part work with sub-tasks
- `[UX/UI]` for interface and user-experience work
- `[Proposal]`, `[Idea]`, and `[Discussion]` for idea-level topics that are often better suited for Discussions than Issues

Label policy:

- `labels.json` in `Adamant-im/.github` is the source of truth for label names, casing, descriptions, and colors
- Keep default GitHub labels lowercase, such as `bug`, `enhancement`, and `documentation`
- Keep custom organization labels capitalized when the org uses capitalized names, such as `Security`, `Privacy`, `Task`, `Composite task`, and `UX/UI`
- For most issues, use a small but informative set: one type label, one or more domain labels, and an optional priority label when justified
- Do not invent legacy workflow labels for tracking state when GitHub Projects already owns that workflow

PR conventions:

- Use the organization PR template sections when preparing PR text
- Use Conventional Commit style for PR titles, for example `Docs: Update AI instructions`
- Do not use issue-style square-bracket prefixes in PR titles
- Keep PR title type aligned with the nature of the change, such as `Docs:`, `Fix:`, `Feat:`, `Refactor:`, `Test:`, or `Chore:`
- Include testing or verification steps and mention meaningful risk areas

## System Map

- Root package: repository metadata, setup hooks, dependency installation, and web build orchestration
- `server/`: backend runtime, ADAMANT API access, config reading and validation, reward distribution, payouts, cron scheduling, local storage, notifications, and HTTP API
- `web/`: dashboard frontend for voters and pool status
- `scripts/`: operational helpers such as process startup and migration from the older pool database
- `config.default.jsonc`: public config reference and schema companion
- `config.jsonc`, `config.json`, `config.test.jsonc`, logs, runtime DB files, and `.ai-ignored/`: local or generated files that must not be committed unless a task explicitly changes that policy
- Current runtime baseline: Node.js 22.13.0 or newer, npm 10 or newer, MongoDB-backed pool storage, and Svelte/Vite dashboard tooling
- LowDB helpers remain only for older data and migration tests unless a task explicitly revives LowDB runtime storage

This repository is expected to be modernized. Do not describe current dependency versions, framework versions, or legacy implementation details as preferred future architecture unless the task explicitly asks for that decision.

## Dependency Safety

When dependency work is requested:

- Follow `.ai-ignored/update-deps-securely.md` before running installs or lockfile refreshes
- Use `ncu` to inspect direct dependency updates and re-run it after installation
- Install with lifecycle scripts disabled by default, for example `npm install --ignore-scripts`
- Do not enable lifecycle scripts globally
- If a package needs a trusted native build or postinstall step, document the package and run the narrowest possible rebuild
- Run `npm audit` in affected package roots and explain any remaining advisories
- Keep dependency additions minimal, especially around networking, cryptography, config parsing, payout logic, and storage

## Security Rules

- Never log, print, commit, or paste pool passphrases, mnemonic material, private keys, Slack keys, ADAMANT notification credentials, API credentials, or local config contents
- Treat `config.jsonc`, `config.json`, and `config.test.jsonc` as sensitive local files
- Keep payout destination fields, reward percentages, donation settings, and maintenance wallet behavior explicit and reviewer-readable
- Validate external input before using it in network requests, payout calculations, database writes, or rendered UI
- Do not introduce dynamic code execution, unsafe deserialization, or shell execution paths fed by untrusted data
- Minimize new dependencies, especially around cryptography, networking, config parsing, and payout logic

## Reward and Payout Safety

- Read the full reward or payout flow before editing `server/src/modules/distribute_rewards.js`, `server/src/modules/pay_out.js`, store helpers, DB helpers, or ADAMANT API helpers
- Preserve accounting invariants for pending rewards, received rewards, transaction fees, donation payments, maintenance payments, and retry behavior
- Avoid broad behavior rewrites unless the task explicitly requires them and tests cover the before/after risk
- Keep reward and payout changes small, auditable, and backed by focused tests or clear manual verification
- When changing config semantics, update `config.default.jsonc`, validation schema, docs, and tests together

## Reliability and Decentralization

- Do not hardcode a single ADAMANT node or service endpoint as the only viable path unless the task explicitly requires it
- Preserve node failover and clear handling of unavailable or unhealthy nodes
- Fail safely on malformed node responses, timeout errors, partial payout failures, and local DB write failures
- Keep operator self-hosting practical and avoid assumptions tied to one deployment environment
- Prefer explicit logs and notifications for operational failures, without exposing secrets

## Frontend Rules

- Keep the dashboard focused on pool status, voter rewards, and transaction visibility
- Preserve mobile usability for the voter dashboard
- Do not expose secret config, admin-only operational details, or raw notification credentials in frontend code
- Validate UI changes with at least a local build when the frontend surface changes

## Change Discipline

- Read relevant modules end-to-end before editing
- Make focused patches and avoid unrelated formatting churn
- Match local style unless the task is specifically modernizing that area
- Add or update tests near changed behavior when practical
- Update docs when behavior, setup, config, or operations change
- Leave generated files and built assets alone unless they are required deliverables

## Validation

For docs-only changes, run:

```sh
git diff --check
```

For server changes, prefer targeted validation first:

```sh
npm --prefix server run lint
npm --prefix server test
```

For frontend changes, prefer:

```sh
npm --prefix web run lint
npm --prefix web run build
```

For setup or root workflow changes, also check the relevant root command, for example:

```sh
npm run build:web
```

For dependency changes, also run affected audits:

```sh
npm audit
npm --prefix server audit
npm --prefix web audit
npm --prefix scripts/migrate-lowdb-mongodb audit
```

Always report exactly which commands were run, whether they passed, and what was intentionally not run.

## Done Criteria

A change is complete only when:

- Payout, reward, and secret-safety risks are preserved or explicitly addressed
- Relevant validation commands were run or blockers were reported
- Documentation/config updates are included for behavior or operator workflow changes
- GitHub issue, label, PR, and temporary-file conventions were followed when publishing metadata
- The result is specific to this repository without freezing obsolete technical choices as future architecture
