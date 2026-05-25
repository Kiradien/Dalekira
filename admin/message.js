const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('admin message');

class message {
    constructor(modules, client, SettingModule) {
        this.name = "message";
        this.modules = modules;
        this.client = client;
        this.settingsModule = SettingModule;
    }

    handleMessage(parameter, msg) {
        let parameters = parameter.split(' ');
        let subcommand = this.getSubcommand(parameters);
        parameters = parameters.slice(1);

        // if (!subcommand)
        // {
        //     return msg.channel.send("**Servers**\n" + this.client.guilds.map(guild => `${guild.id}   ${guild.name}`).join('\n'));
        // }
        if (!!subcommand)
        {
            if (subcommand == "send")
            {
                subcommand = this.getSubcommand(parameters);
                parameters = parameters.slice(1);
                if (!!subcommand && !isNaN(subcommand)) //Is the command a number? If so, probably server Id
                {
                    let channel = this.client.channels.filter(channel => channel.id == subcommand).map(channel => channel)[0];

                    if (!!channel)
                    {
                        return channel.send(parameters.join(" "), {
                                files: msg.attachments.map(attachment => attachment.proxyURL)
                        });
                    }

                }
            }
            else if (subcommand == "get")
            {
                subcommand = this.getSubcommand(parameters);
                parameters = parameters.slice(1);
                if (!!subcommand && !isNaN(subcommand)) //Is the command a number? If so, probably server Id
                {
                    let channel = this.client.channels.filter(channel => channel.id == subcommand).map(channel => channel)[0];
                    let msgCount = 10;

                    subcommand = this.getSubcommand(parameters);
                    parameters = parameters.slice(1);
                    if (!!subcommand && (subcommand == "update" || subcommand == "edit"))
                    {
                        subcommand = this.getSubcommand(parameters);
                        parameters = parameters.slice(1);
                        if (!!subcommand && !isNaN(subcommand))
                        {
                            return channel.fetchMessage(subcommand)
                                .then(message => {
                                    if (message.editable && !!parameters)
                                    {
                                        message.edit(parameters.join(" "))
                                            .then(edittedMessage => msg.channel.send("Updated"))
                                            .catch(error => msg.channel.send("Error!!!"));
                                    }
                                    else
                                    {
                                        msg.channel.send("Insufficent permissions");
                                    }
                                });
                        }
                    }
                    // else if (!!subcommand && (subcommand == "react"))
                    // {
                    //     subcommand = this.getSubcommand(parameters);
                    //     parameters = parameters.slice(1);
                    //     if (!!subcommand && !isNaN(subcommand))
                    //     {
                    //         console.log(parameters[0]);
                    //         if (parameters && parameters.length > 0)
                    //         {
                    //             return channel.fetchMessage(subcommand)
                    //                 .then(message => {
                    //                     message.react(parameters[0])
                    //                         .then(edittedMessage => msg.channel.send("Reacted"))
                    //                         .catch(error => msg.channel.send("Error!!!"));
                    //                 });
                    //         }
                    //     }
                    // }
                    else if (!!subcommand && !isNaN(subcommand))
                    {
                        msgCount = subcommand;
                    }

                    return channel.fetchMessages({ limit: msgCount })
                        .then(messages => {
                            
                            let embed = new Discord.RichEmbed();

                            embed.description = messages.map(message => `[${message.id}] [${message.author.username}] ${message.content}`).join('\n');

                            //console.log(messages);
                            msg.channel.send(`Last ${msgCount} Messages`, embed);
                        });
                }
            }
            else if (subcommand == "save")
            {
                subcommand = this.getSubcommand(parameters);
                parameters = parameters.slice(1);
                if (!!subcommand && !isNaN(subcommand)) //Is the command a number? If so, probably server Id
                {
                    let channel = this.client.channels.filter(channel => channel.id == subcommand).map(channel => channel)[0];
                    var settings = this.settingsModule.getSettings(channel.guild);

                    let index = settings.admin.StoreChannels.indexOf(subcommand);

                    if (index > -1)
                    {
                        settings.admin.StoreChannels.splice(index, 1);
                    }
                    else
                    {
                        settings.admin.StoreChannels.push(subcommand);
                    }

                    this.settingsModule.saveSettings(channel.guild);

                    
                    if (index > -1)
                    {
                        return msg.channel.send("Removed channel save setting");
                    }
                    else
                    {
                        return msg.channel.send("Added channel save setting");
                    }
                }

            }
        }
        

        return msg.channel.send('Use !admin message send channelId. Get this from !admin servers');
    }

    getSubcommand(parameters)
    {
        let retval = parameters[0] || "";
        retval = retval.toLowerCase().trim();
        return retval;
    }
}
module.exports = message;
//467792617015345172