
# Wishmaster [![Build Status](https://travis-ci.com/VashSan/wishmaster.svg?branch=master)](https://travis-ci.com/VashSan/wishmaster) [![codecov](https://codecov.io/gh/VashSan/wishmaster/branch/master/graph/badge.svg)](https://codecov.io/gh/VashSan/wishmaster)

An IRC bot for Twitch streamers. This is a rapid protoyping project I use to learn TypeScript & NEDB.

## Working directory
All files are stored in the folder ```%localappdata%\.wishmaster```. 
The file ```wishmaster.json``` contains the configuration.
The files ending with ```.db``` are the Nedb database files.
Files ending with ```.log``` are generated by the logger.

## Configuration
The bot is designed to run on a single channel, using the broadcaster account. 
Of course you may try to make use it as a mod or even with a viewer account. 
Then some features may not work as expected, I will be happy if you create an issue on [GitHub](https://github.com/VashSan/wishmaster/issues) then.

Right now you need to setup the configuration manually. Please [look it up in the Wiki](https://github.com/VashSan/wishmaster/wiki/Configuration).

## Installation
More detailed instructions will follow if the bot is ready to be released for a broader audience.
You will need to install Node, download the sources, run `npm run build` once and start with `node app.js`.

## Setup Workspace
If you want to contribute use following settings. I recommend Visual Studio Code as editor.

* Install [NodeJS](https://nodejs.org)
* npm -g install typescript
* npm -g install eslint
* add excludes to workspace settings

			"**/.git": true,
			"**/*.js.map": true,
			"**/*.js": { "when": "$(basename).ts" },
			"**/**.js": { "when": "$(basename).tsx" }
