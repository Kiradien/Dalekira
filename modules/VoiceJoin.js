const _ = require('lodash');
const Discord = require('discord.js');

class VoiceJoin {
    constructor(modules) {
        this.name = "VoiceJoin";
        this.commands = {
            VoiceJoinRole: {
                aliases: [],
                inline: false,
                multiline: false,
                description: "Roles for users currently in voice chat",
                help: 'Set and remove a certain role from users upon entering voice chat.',
                examples: [
                    "!VoiceJoinRole add @rolename",
                    "!VoiceJoinRole remove @rolename",
                    "!VoiceJoinRole"
                ]
            }
        };
        this.settingsModule = modules[0];
        this.modules = modules;
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        if (msg.guild && (msg.member.hasPermission("ADMINISTRATOR") || msg.member.hasPermission("MANAGE_GUILD") || msg.author.id === '113803878322929664' ))
        {
            let settings = this.settingsModule.getSettings(msg.guild);

            if (!settings.module["voicejoin"])
            {
                settings.module["voicejoin"] = {};
            }
            settings.module["voicejoin"].roles = settings.module["voicejoin"].roles || [];

            // let channel = msg.mentions.channels.first();
            // let channelSettings = settings.module["voicejoin"].channels[channel.id] || {};

            let subcommands = parameter.split(" ");
            
            if (subcommands.length > 1)
            {
                if (msg.mentions.roles.size > 0)
                {
                    let mentionedRoles = msg.mentions.roles.array().map((index, item, self) => {
                            return self[item].id;
                        });
                    let params = subcommands.splice(2).join(" ");
                    let retval = null;
                    switch(subcommands[0].toLowerCase())
                    {
                        case "add":
                            //retval = this.handleFormatCommand(params, msg);
                            settings.module["voicejoin"].roles = settings.module["voicejoin"].roles.concat(mentionedRoles)
                                .filter((item, index, self) => { return !!item && self.indexOf(item) == index; });

                            this.settingsModule.saveSettings(msg.guild);
                            break;
                        case "remove":
                            settings.module["voicejoin"].roles = settings.module["voicejoin"].roles.filter((item, index, self) => { return mentionedRoles.indexOf(item) == -1; });
                            this.settingsModule.saveSettings(msg.guild);
                            break;
                        default:
                            break;
                    }
                }
            }
            //console.log(this.helpOptions);
            //return msg.channel.send('Unrecognized subcommand or missing fields!', this.helpOptions);
            return msg.channel.send(`List of roles to add when entering voice chat: \n${settings.module["voicejoin"].roles.map(item => `<@&${item}>`).join('\n')}`);
        }

        return msg.channel.send('Insufficient privileges to access this command.', {});
    }

    
    handleEvent(oldMember, newMember){
        let userGuild = newMember.guild;
        let newUserChannel = newMember.voiceChannel;
        var settings = this.settingsModule.getSettings(userGuild);
    
        if ( !!newMember.guild && !!settings && !!settings.module["voicejoin"] && !!settings.module["voicejoin"].roles && settings.module["voicejoin"].Global )
        {
            if (!newUserChannel)
            {
                //User is not in voice channel
                newMember.removeRoles(settings.module["voicejoin"].roles, "[VoiceJoin module] User left Voice Channel")
                    //.then(console.log)
                    .catch(() => {
                        //console.error
                    });
            }
            else
            {
                //User is in voice channel
                newMember.addRoles(settings.module["voicejoin"].roles, "[VoiceJoin module] User joined Voice Channel")
                .then(result => {
                    //console.log(result);
                })
                .catch(() => {
                    //console.error
                });
            }
        }

    }
}
module.exports = VoiceJoin;
