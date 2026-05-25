const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('cMan');

class cMan {
    constructor(modules) {
        this.name = "cman";
        this.commands = {
            cMan: {
                aliases: [],
                inline: false,
                multiline: false,
                description: "Channel Management commands (Require server privilages)",
                help: 'Just call the command to see what it does',
                examples: [
                    "!cMan format #channel remove",
                    "!cMan format #channel mtgaDeck",
                    "!cMan format #channel regex [Replace with Regular expression]",
                    "!cMan format #channel regex (\\w+ \([0-9]+\)\\s*\\n)+",
                    "!cMan frequency #channel month 1"
                ]
            }
        };
        this.settingsModule = modules[0];
        this.modules = modules;
        this.helpOptions = {
        "embed" : {
            "title": "List of available subcommands",
            "description": "Unrecognized Subcommand. A list of available subcommands is below. All commands require the channel to be specified; replace #channel with a link to the desired discord channel.",
            "fields": [
            {
                "name": "Format",
                "value": "Restrict the format of messages permitted in the channel.\n"
                    + "```!cMan format #channel remove```"
                    + "```!cMan format #channel mtgaDeck```"
                    + "```!cMan format #channel regex [Replace with Regular expression]```"
                    + "```!cMan format #channel regex (\\w+ \([0-9]+\)\\s*\\n)+```"
            },
            {
                "name": "Frequency",
                "value": "Restrict the frequency users can send messages\n"
                + "```!cMan frequency #channel 1 month```"
                + "```!cMan frequency #channel 1 week```"
                + "```!cMan frequency #channel 1 day```"
                + "```!cMan frequency #channel 1 hour```"
                + "```!cMan frequency #channel 1 minute```"
                + "```!cMan frequency #channel 10 seconds```",
                "inline": false
            }
            ]
        }};
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        /*
        Seems like 3 main points: 
            1) Restrict messages to decklist format
            2) Restrict users to 1 message per month.
            3) [Potentially] Delete old messages at the start of a new month 
                (Maybe just ones marked with the NANI reaction?)
        */
       //if (msg.guild && (msg.member.hasPermission("ADMINISTRATOR") || msg.member.hasPermission("MANAGE_GUILD") || msg.author.id === '113803878322929664' ))
        if (msg.author.id === '113803878322929664' )
        {
            let subcommands = parameter.split(" ");
            
            if (subcommands.length > 2)
            {
                if (msg.mentions.channels.size > 0)
                {
                    let params = subcommands.splice(2).join(" ");
                    let retval = null;
                    switch(subcommands[0].toLowerCase())
                    {
                        case "format":
                            retval = this.handleFormatCommand(params, msg);
                            break;
                        case "frequency":
                            break;
                        default:
                            break;
                    }

                    if (!!retval)
                    {
                        return retval;
                    }
                }
            }
            //console.log(this.helpOptions);
            return msg.channel.send('Unrecognized subcommand or missing fields!', this.helpOptions);
        }

        return msg.channel.send('Insufficient privileges to access this command.', {});
    }

    handleFormatCommand(params, msg)
    {
        if (!!msg.guild)
        {
            let settings = this.settingsModule.getSettings(msg.guild);

            if (!settings.module["cMan"])
            {
                settings.module["cMan"] = {};
                settings.module["cMan"].channels = {};
            }

            let channel = msg.mentions.channels.first();
            let channelSettings = settings.module["cMan"].channels[channel.id] || {};

            let paramSplit = params.split(" ");

            if (paramSplit[0].toLowerCase() == "mtgadeck")
            {
                channelSettings.Format = `(\\d+) ([\\w\\',\\-\\s/]+?)\\s\\((.*?)\\)\\s(\\d+)?`;
            }
            else if (paramSplit[0] == "" || paramSplit[0].toLowerCase() == "remove")
            {
                channelSettings.Format = null;
            }
            else if (paramSplit.length > 1)
            {
                channelSettings.Format = paramSplit.splice(1).join(" ");
            }
            else
            {
                return null; //msg.channel.send("")
            }

            settings.module["cMan"].channels[channel.id] = channelSettings;

            this.settingsModule.saveSettings(msg.guild);

            return msg.channel.send("Settings saved for channel: " + channel, {});
        }
    }

    handleFrequencyCommand(params, msg)
    {
        if (!!msg.guild)
        {
            let settings = this.settingsModule.getSettings(msg.guild);

            if (!settings.module["cMan"])
            {
                settings.module["cMan"] = {};
                settings.module["cMan"].channels = {};
            }

            let channel = msg.mentions.channels.first();
            let channelSettings = settings.module["cMan"].channels[channel.id] || {};

            let paramSplit = params.split(" ");

            ///
            channelSettings.Frequency = {};
            channelSettings.Frequency.Type = 1; //1 = seconds, 2 = "day" (reset @ midnight not 24hr), 3 = week (not 7 day), 4 = month (same as earlier), 5 = year
            channelSettings.Frequency.TimeFrameMultiplier = 1; //60 = minute, 3600 = hour 
            ///

            settings.module["cMan"].channels[channel.id] = channelSettings;

            this.settingsModule.saveSettings(msg.guild);

            return msg.channel.send("Settings saved for channel: " + channel, {});
        }
    }

    manageMessages(msg)
    {
        if (!!msg.guild)
        {
            let settings = this.settingsModule.getSettings(msg.guild);

            if (!settings.module["cMan"])
            {
                settings.module["cMan"] = {};
                settings.module["cMan"].channels = {};
            }

            let channelSettings = settings.module["cMan"].channels[msg.channel.id];
            if (channelSettings)
            {
                let format = channelSettings.Format;
                let frequency = channelSettings.Frequency;

                if (!!format)
                {
                    let regExpObject = new RegExp(format, 'ig');

                    let msgContent = msg.content;
                    let matches = msgContent.match(regExpObject);

                    if (!matches && msg.deletable && (msg.guild && !msg.member.hasPermission("ADMINISTRATOR")))
                    {
                        msg.delete().then(message => {

                            let msgOptions = {
                                "embed" : {
                                    "title": "Your message",
                                    "description": msgContent,
                                    "footer": {text: "Please refer to channel rules for further details on message requirements.", 
                                            icon_url: "https://cdn.discordapp.com/emojis/482568305648074752.gif?v=1"}
                                }};

                            message.author.send(`The message you tried to send in ${message.guild} ${message.channel} did not meet the server requirements and has been removed.`, msgOptions).catch(console.error);
                            
                            log.info(`Deleted message from ${message.author.username}#${message.author.discriminator} ${message.author} in ${message.guild} ${message.channel}
                            Content:\n${msgContent}`);
                        }).catch(console.error);
                    }
                    else
                    {
                        //No action required.
                    }
                }
            }
        }
    }
}
module.exports = cMan;
