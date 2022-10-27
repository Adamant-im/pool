# Contributing Guide

Hi! We are really excited that you are interested in contributing to ADAMANT. Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines

- Always use https://github.com/Adamant-im/pool/issues to create new issues.

## Pull Request Guidelines

- The `master` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches. **Do not submit PRs against the `master` branch.**

- Checkout a topic branch from the relevant branch, e.g. `dev`, and merge back against that branch.

- Work in the `src` folder and **DO NOT** check-in `dist` in the commits.

- It's OK to have multiple small commits as you work on the PR - GitHub will automatically squash it before merging.

- Make sure `npm run lint` passes. (see [development setup](#development-setup))

- If adding a new feature:
  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
  - If you are resolving a special issue, add `(fix #xxxx[,#xxxx])` (#xxxx is the issue id) in your PR title for a better release log, e.g. `update entities encoding/decoding (fix #3899)`.
  - Provide a detailed description of the bug in the PR. Live demo preferred.
  - Add appropriate test coverage if applicable.

## Development Setup

You will need [NodeJS](http://nodejs.org/) and npm.

After cloning the repo, run:

``` bash
$ npm install # install the dependencies of the project and husky
```

If you are only going to work with server logic, you can build the web part:

```bash
$ npm run build:web
```

## Project Structure

This repository employs a [monorepo](https://en.wikipedia.org/wiki/Monorepo) setup which hosts a number of associated packages under the root directory:

- **`server`**: contains server logic

  - Commonly used npm commands:

    ```bash
    # start the server
    $ npm run start

    # run linter
    $ npm run lint

    # run all tests
    $ npm run test
    ```

  - Create and use `config.test.jsonc` config file instead of default one

- **`web`**: contains front-end part

  - Commonly used npm commands:

    ```bash
    # start dev server
    $ npm run dev

    # run linter
    $ npm run lint

    # build the web
    $ npm run build
    ```

  - You can create `.env` file to use custom API base url, e.g.:

    ```bash
    VITE_BASE_URL=http://localhost:36667/api
    ```
