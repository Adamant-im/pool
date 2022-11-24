> Read more about [Forging, delegates, Fair dPoS, and how to run your Forging pool](https://medium.com/adamant-im/earning-money-on-adm-forging-4c7b6eb15516).

<br>

<p align="center">
  <img src="./assets/logo.png#gh-light-mode-only" height="60"/>
  <img src="./assets/logo-dark.png#gh-dark-mode-only" height="60"/>
</p>

<p align="center">
 Calculate and transfer voters’ rewards automatically.
</p>

<h1></h1>

* :rainbow: Easy to install
* :handshake: Reliable, uses decentralized network advantages
* :hammer_and_wrench: Customizable (using config file)
* :scroll: History stored in local files (powered by [lowdb](https://github.com/typicode/lowdb))
* :rocket: Minimum server requirements: 1 vCPU and 512 MB of RAM
* :carpentry_saw: You can setup the pool on a separate machine without a node
* :chart_with_upwards_trend: Dashboard for voters with mobile version support
* :bell: Notification system via ADAMANT or Slack for admin

## Installation

### Requirements

* NodeJS v16+ (already installed if you have a node on your machine)

### Setup

Clone the repository with pool into a newly created directory:

```
git clone https://github.com/Adamant-im/adamant-pool
```

Move to directory with the cloned repository:

```
cd adamant-pool
```

Install dependencies using npm or any other package manager:

```
npm install
```

Build a website:

```
npm run build:web
```

### Pre-launch tuning

Copy default config as `config.jsonc`:

```
cp config.default.jsonc config.jsonc
```

And edit that file by inserting the pool's secret phrase as the minimum configuration, e.g. using `nano`:

```
nano config.jsonc
```

> See comments in `config.default.jsonc` for more parameters.

## Launching

You can start the pool using `npm` command:

```
npm run start
```

but we recommend to use a process manager to start the pool, f.e. [`pm2`](https://pm2.keymetrics.io/):

```
pm2 start ./start.sh --name "ADAMANT Pool"
```

## Add pool to cron

Edit crontab file using the command below:

```
crontab -e
```

and paste the string:

```
@reboot cd /home/adamant/pool && pm2 start /home/adamant/pool/start.sh --name "ADAMANT Pool"
```

## Contribution

Please have a look at the [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
