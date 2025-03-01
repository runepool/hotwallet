<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Liquidium DEX

A decentralized exchange for Rune assets built with NestJS and Electron.

## Description

Liquidium DEX is a desktop and server application that allows users to trade Rune assets on the Bitcoin network.

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start:dev

# production mode
$ yarn run start:prod

# electron desktop app
$ yarn run start:electron
```

## Building the app

The application can be built in two modes:
- **Desktop mode**: Creates an Electron desktop application
- **Server mode**: Creates a server distribution package

### Build Commands

```bash
# Build desktop application for mainnet
$ yarn run build:desktop

# Build desktop application for testnet
$ yarn run build:desktop:testnet

# Build server distribution for mainnet
$ yarn run build:server

# Build server distribution for testnet
$ yarn run build:server:testnet
```

### Advanced Build Options

You can also use the build script directly with additional options:

```bash
$ node build.js --type <desktop|server> --env <development|production> --network <mainnet|testnet> --output <directory>
```

Options:
- `--type` or `-t`: Build type (desktop or server), default: desktop
- `--env` or `-e`: Environment (development or production), default: production
- `--network` or `-n`: Bitcoin network (mainnet or testnet), default: mainnet
- `--output` or `-o`: Output directory for the build, default: ./dist-electron

## Testing

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## License

This project is [MIT licensed](LICENSE).
