const Discord = require('discord.js');

const _ = require("lodash");
const utils = require("./utils");
const log = utils.getLogger('bot');
const fileMan = new (require("./admin/fileman.js"))();

//Globally increase max listener count
require('events').EventEmitter.prototype._maxListeners = 300;

const client = new Discord.Client();
const debug = true;

// remember timestamps for last message per user
const userMessageTimes = {};
const spamTimeout = 100; // milliseconds
var clientError = 0;
var adminOverride = false;

var SettingModule;
var cManModule;
var voiceJoinModule;

const commandChar = process.env.COMMAND_CHAR || "!";

// #region Modules
const modules = [
    'settings',
    //'webnovel_epub',
    'magiccard',
    //'magicdeck',
    'help',
    //'YGOcard',
    'simpleExample',
    "anime",
    "UrbanDictionary",
    'epub',
    'cMan',
    'VoiceJoin'
];
const handlers = {};
const commands = {};

modules.forEach((module, index) => {
    // eslint-disable-line global-require
    const moduleObject = new (require("./modules/" + module + '.js'))(modules, fileMan);
    if(moduleObject) {
        log.info("Successfully initialized module", module);
        modules[index] = moduleObject;
        let command;
        _.forEach(moduleObject.getCommands(), (commandObj, command) => {
            command = command.toLowerCase();
            handlers[command] = handlers[command] || [];
            handlers[command].push(moduleObject);
            commands[command] = commandObj;
            // map aliases to handlers as well
            if (commandObj.aliases) {
                commandObj.aliases.forEach(alias => {
                    alias = alias.toLowerCase();
                    handlers[alias] = handlers[alias] || [];
                    handlers[alias].push(moduleObject);
                    //handlers[alias] = moduleObject;
                    commands[alias] = commandObj;
                });
            }
        });
    } else {
        log.error("Couldn't initialize module", module);
    }
    SettingModule = handlers["settings"][0];
});

// #endregion Modules

const adminModules = [
    'servers',
    'message',
    'users'
];
const adminHandlers = {};

adminModules.forEach((module, index) => {
    // eslint-disable-line global-require
    const moduleObject = new (require("./admin/" + module + '.js'))(adminModules, client, SettingModule);
    if(moduleObject) {
        log.info("Successfully initialized admin module", module);
        adminModules[index] = moduleObject;
        adminHandlers[module] = moduleObject;
    } else {
        log.error("Couldn't initialize module", module);
    }
    
});

// generate RegExp pattern for message parsing
// Example: ((^|\s)!(card|price|mtr)|^!(hangman|standard|jar|help))( .*?)?(![^a-z0-9]|$)
const charPattern = _.escapeRegExp(commandChar);
// split inline and non-inline commands into 2 patterns
const commandPattern = '(^|\\s)' + charPattern + '(' +
    Object.keys(commands).filter(cmd => commands[cmd].inline && !commands[cmd].multiline).map(_.escapeRegExp).join('|')
    + ')|^' + charPattern + '(' +
    Object.keys(commands).filter(cmd => !commands[cmd].inline && !commands[cmd].multiline).map(_.escapeRegExp).join('|')
    + ')';
const multilinePattern = charPattern + '(' +
    Object.keys(commands).filter(cmd => commands[cmd].multiline).map(_.escapeRegExp).join('|')
    + '(.*\\n?)*)';
const regExpPattern = `((${commandPattern})( .*?)?(${charPattern}[^a-z0-9]|$)|${multilinePattern})`;
const regExpObject = new RegExp(regExpPattern, 'ig');
const regExpAdminPattern = `!admin (\\w+)( (.*))*`;
const regExpAdminObject = new RegExp(regExpAdminPattern, 'ig');

client.on('ready', () => {
    SettingModule = handlers["settings"][0];
    cManModule = handlers["cman"][0];
    voiceJoinModule = handlers["voicejoinrole"][0];
    console.log('Bot is Running!');
    log.info('Bot is ready! Username:', client.user.username, '/ Servers:', client.guilds.size );
    utils.updateServerCount(client);
});

client.on('guildCreate', (guild) => {
    log.info(utils.prettyLog({guild}, "joined"));
    utils.updateServerCount(client);
});

client.on('guildDelete', (guild) => {
    log.info(utils.prettyLog({guild}, "left"));
    utils.updateServerCount(client);
});

client.on('error', (error) => {
    log.error('client error received');
    if (++clientError > 10)
    {
        log.error(error);
        //console.log(error);
        clientError = 0;
    }
});

client.on('resume', replayed => {
    clientError = 0;
});

client.on('message', (msg) => {
    new Promise(resolve =>
    {
        try 
        {
            var settings = SettingModule.getSettings(msg.guild);
        
            var queries = msg.content.match(regExpObject);
            
            var lastMessage = userMessageTimes[msg.author.id] || 0;
            let command;
        
            // if the message mentions us, log it
            if (!msg.author.bot && // don't log if a bot mentions us
                (msg.content.toLowerCase().indexOf(client.user.username.toLowerCase()) > -1 ||
                    msg.mentions.users.has(client.user.id))) {
                log.info(utils.prettyLog(msg, 'mention', msg.content));
            }
        
            // check if the message...
            if (queries && // ...contains at least one command
                !msg.author.bot && // ...is not from a bot
                //(!msg.guild || msg.guild.id !== '110373943822540800') && // ...is not from a blacklisted server
                new Date().getTime() - lastMessage >= spamTimeout) // ...is outside the spam threshold
            {
                // store the time to prevent spamming from this user
                userMessageTimes[msg.author.id] = new Date().getTime();
        
                // only use the first 3 commands in a message, ignore the rest
                queries.slice(0, 3).forEach(query => {
        
                    command = query.trim().replace("\n", " \n").split(" ")[0].substr(commandChar.length).toLowerCase();
                    var commandRun = false;

                    if (!!handlers[command])
                    {
                        handlers[command].forEach(handler =>
                        {
            
                            var commandModule = handler.name.toLowerCase();
                
                            if ( msg.guild === null ||
                                (
                                    (settings.module[commandModule].Global || settings.module[commandModule].EnabledChannels.indexOf(msg.channel.id) > -1)
                                    && settings.module[commandModule].DisabledChannels.indexOf(msg.channel.id) === -1 && !commandRun
                                ) ||
                                msg.author.id === '113803878322929664' && adminOverride
                            )
                            {
                                commandRun = true;
                                var parameter = query.trim().split(" ").slice(1).join(" ").replace(new RegExp(charPattern + '[^a-z0-9]?$', 'i'), '');
                                
                                let logparam = parameter.split('\n')[0];
                                log.info(utils.prettyLog(msg, 'query', (command+' '+logparam).trim()));
                                var ret = handler.handleMessage(command, parameter, msg);
                                //Start "Typing" to show request was detected.
                                msg.channel.startTyping();
                                // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
                                Promise.resolve(ret)
                                    .then(val => {
                                        try 
                                        {
                                            msg.channel.stopTyping();
                                        }
                                        catch (ex)
                                        {
                                            console.log("Exception happened stopping typing.");
                                        }
                                    }).catch(e => {
                                        try 
                                        {
                                            msg.channel.stopTyping();
                                        }
                                        catch (ex)
                                        {
                                            console.log("Exception happened stopping typing.");
                                        }
                                        log.error('An error occured while handling', msg.content, ":", e.message);
                                    });
                            }
                            // else
                            // {
                            //     log.info(utils.prettyLog(msg, 'DisabledQuery', (command).trim()));
                            // }
                        });
                    }
                    else
                    {
                        log.error("An error occured finding command", command, ":", msg.content);
                    }
                });
            }

            //Commands done by global admin
            if (msg.author.id === '113803878322929664')
            {
                if (adminOverride)
                {
                    adminOverride = false;
                }

                queries = msg.content.match(regExpAdminObject);
                let queries2 = msg.content.match(regExpAdminObject);

                if (queries && queries.length > 0)
                {
                    command = queries[0].trim().split(" ")[0].substr(1).toLowerCase();
                    if (command === "admin")
                    {
                        let subcommand = queries[0].trim().split(" ")[1].toLowerCase();

                        if (!!adminHandlers[subcommand])
                        {
                            let parameter = queries[0].trim().split(" ").slice(2).join(" ");

                            var ret = adminHandlers[subcommand].handleMessage(parameter, msg);
                            // if ret is undefined or not a thenable this just returns a resolved promise and the callback won't be called
                            Promise.resolve(ret).catch(e => log.error('An error occured while handling', msg.content, ":", e.message));
                            
                        }

                        if (subcommand == "override")
                        {
                            adminOverride = true;
                        }
                        
                        // if (subcommand == "servers")
                        // {
                            
                        // }

                        // console.log(queries);
                    }
                }
            }

            if (!!settings && settings.admin.StoreChannels.indexOf(msg.channel.id) > -1)
            {
                let date = new Date();
                let dateString = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
                let message = { content: msg.content, author: { name: msg.author.username, id: msg.author.id }, attachments: msg.attachments.map(attachment => attachment.proxyURL), time: date };
                fileMan.addData("chatlogs", `${msg.channel.id}_${dateString}`, message);
            }

            if (!msg.author.bot)
            {
                //Don't manage bot messages.
                cManModule.manageMessages(msg);
            }
            
            if (debug)
            {
                //console.log(settings);
                //var settings = getSettings(message.guild);
                //saveSettings(message.guild);
            }
        }
        catch (ex)
        {
            log.error(`Unhandled Exception occurred. Catching at top level. \r\n` + ex);
        }
    });
});


client.on('voiceStateUpdate', (oldMember, newMember) => {
    new Promise( resolve => {
        voiceJoinModule.handleEvent(oldMember, newMember);
    });
});


try {
    client.login(process.env.DISCORD_TOKEN);
} catch(err) {
    log.error(err);
}