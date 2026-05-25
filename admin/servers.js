const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('admin servers');

class server {
    constructor(modules, client) {
        this.name = "server";
        this.modules = modules;
        this.client = client;
    }

    handleMessage(parameter, msg) {
        let parameters = parameter.split(' ');
        let subcommand = this.getSubcommand(parameters);
        parameters = parameters.slice(1);

        if (!subcommand)
        {
            return msg.channel.send("**Servers**\n" + this.client.guilds.map(guild => `${guild.id}   ${guild.name}`).join('\n'));
        }
        else if (!isNaN(subcommand)) //Is the command a number? If so, probably server Id
        {
            let servers = this.client.guilds.filter(guild => guild.id == subcommand).map(guild => guild);
            let server = servers[0];

            if (!!server)
            {
                subcommand = this.getSubcommand(parameters);
                parameters = parameters.slice(1);

                if (subcommand == "channel")
                {
                    subcommand = parameters[0];
                    parameters = parameters.slice(1);
                    if (!subcommand)
                    {
                        let filteredChannels = server.channels.filter(channel => channel.type == "text");
                        //console.log(filteredChannels);
                        return msg.channel.send("**Channels**\n" 
                            + filteredChannels.map(channel => `${channel.id}  ${channel.name}(${(channel.parent || { name : "" }).name})`).join('\n'));
                    }
                }

            }
        }

        return msg.channel.send('Use !admin servers (*serverid*) (channel) syntax!');
    }

    getSubcommand(parameters)
    {
        let retval = parameters[0] || "";
        retval = retval.toLowerCase().trim();
        return retval;
    }
}
module.exports = server;
//129697888811876352