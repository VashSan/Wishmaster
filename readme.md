# Wishmaster
I am learning TypeScript / NEDB with this project.

## Working directory
All files are stored in the folder ```%localappdata%\.wishmaster```. 
The file ```wishmaster.json``` contains the configuration.
The files ending with ```.db``` are the Nedb database files.
Files ending with ```.log``` are generated by the logger.

### Configuration
Remember to strip the comments before saving it as configuration file.
```javascript
{
	/** The host name to connect to  */
	"server": "irc.twitch.tv", 

	/** The name used to log on to the server */
	"nickname": "vash1080", 

	/** The OAuth (1) token to identify yourself. Regular passwords are not supported. */
	"password": "oauth:",

	/** The channel to connect to. */
	"channel": "#vash1080",

	/** The bot limit itself to this number of messages in 30 seconds. (2) */
	"msgLimitPer30Sec": 20,

	/** log,info,warn,error ... remove a token to avoid being written to log file. */
	"verbosity": "info,warn,error",
	
	/** Set to true to create a log file within .wishmaster directory. */
	"createLogFile": false,

	/** Set to true to write log messages to console. */
	"createLogConsole": true,

	/** Logger automatically deletes old log files. */
	"maxLogAgeDays": 10,
}
```

1. An oauth token can be generated easily by using the 
[Twitch Chat OAuth token generator](https://twitchapps.com/tmi/). 

   If you ever lose control over this token, 
   [disconnect the app from Twitch](https://www.twitch.tv/settings/connections). 
   You will not need to reset yout password.

2. Check appropriate limit bat or below what 
[Twitch recommends on their dev portal](https://dev.twitch.tv/docs/irc).

   ATOW the limit is 20 per 30 seconds for Users sending commands or messages to 
   channels in which they do not have Moderator or Operator status. It is 100 per 30 
   seconds for moderators or operators.



## Setup Workspace
* Install Node
* npm -g install typescript
* npm -g install eslint
* add excludes to workspace settings

			"**/.git": true,
			"**/*.js.map": true,
			"**/*.js": { "when": "$(basename).ts" },
			"**/**.js": { "when": "$(basename).tsx" }
