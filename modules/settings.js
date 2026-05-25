const _ = require('lodash');
const Discord = require('discord.js');
const extend = require('extend');
const fs = require('fs');

class Settings {
    constructor(modules) {
        this.name = "settings";
        this.commands = {
            settings: {
                aliases: ['setting'],
                inline: false,
                description: "Configure enabled modules for this server. Call the command on its own to get a list of modules.",
                help: 'This command lets you configure the server.',
                examples: ["!settings", "!settings simpleExample", '!settings simpleExample enable', '!settings simpleExample disable']
            }
        };
        this._settings = [];
        this.modules = modules;
        this.moduleNames = [];

        modules.forEach(module => {
            if (module === "settings" || module === "help")
            {
                //continue;
            }
            else
            {
                this.moduleNames.push(module.toLowerCase());
            }
        });
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        //Only allow admins / Managers edit this setting.
        if (msg.guild && (msg.member.hasPermission("ADMINISTRATOR") || msg.member.hasPermission("MANAGE_GUILD") || msg.author.id === '113803878322929664' ))
        {

            let params = parameter.trim().toLowerCase().split(" ");
            let param = params[0];

            let settings = this.getSettings(msg.guild);

            const embed = new Discord.RichEmbed({
                title: 'List of available commands',
                // thumbnail: {url: this.thumbnail},
                url: this.location
            });
            let description = '';

            if (parameter && this.moduleNames.indexOf(param) > -1) {
                let showHelp = false;
                if (params.length > 1)
                {
                    if (params[1].toLowerCase() === 'enable')
                    {
                        embed.title = `${param} enabled`;

                        if (msg.mentions.channels.size > 0)
                        {
                            msg.mentions.channels.forEach(channel => {
                                if (!settings.module[param].Global && settings.module[param].EnabledChannels.indexOf(channel.id) == -1)
                                {
                                    settings.module[param].EnabledChannels.push(channel.id);
                                }
                                let disableIndex = settings.module[param].DisabledChannels.indexOf(channel.id);
                                while (disableIndex != -1)
                                {
                                    settings.module[param].DisabledChannels.splice(disableIndex, 1);
                                    disableIndex = settings.module[param].DisabledChannels.indexOf(channel.id);
                                }
                                description += `${channel.name} \n`;
                            });
                        }
                        else
                        {
                            settings.module[param].Global = true;
                        }
                    }
                    else if (params[1].toLowerCase() === 'disable')
                    {
                        embed.title = `${param} disabled`;

                        if (msg.mentions.channels.size > 0)
                        {
                            msg.mentions.channels.forEach(channel => {
                                if (settings.module[param].Global && settings.module[param].DisabledChannels.indexOf(channel.id) == -1)
                                {
                                    settings.module[param].DisabledChannels.push(channel.id);
                                }
                                let enableIndex = settings.module[param].EnabledChannels.indexOf(channel.id);
                                while (enableIndex != -1)
                                {
                                    settings.module[param].EnabledChannels.splice(enableIndex, 1);
                                    enableIndex = settings.module[param].EnabledChannels.indexOf(channel.id);
                                }
                                description += `${channel.name} \n`;
                            });
                        }
                        else
                        {
                            settings.module[param].Global = false;
                        }
                    }
                    else
                    {
                        showHelp = true;
                    }
                }
                else
                {
                    showHelp = true;
                }


                if (showHelp)
                {
                    var currentStatus = settings.module[param];
                    var enabledChannels = [];
                    var disabledChannels = [];
                    if (currentStatus.Global)
                    {
                        enabledChannels.push("Global");

                        currentStatus.DisabledChannels.forEach(channelId => {
                            var channel = msg.guild.channels.find("id", channelId);
                            if (channel)
                            {
                                disabledChannels.push(channel.toString());
                            }
                        });
                    }
                    else
                    {
                        disabledChannels.push("Global");
                        currentStatus.EnabledChannels.forEach(channelId => {
                            var channel = msg.guild.channels.find("id", channelId);
                            if (channel)
                            {
                                enabledChannels.push(channel.toString());
                            }
                        });
                    }

                    var fieldString;
                    embed.setTitle('Command "!settings '+param+'"');
                    if (enabledChannels.length > 0)
                    {
                        fieldString = '';

                        enabledChannels.some(function(element, index) {
                            if (element === "Global")
                            {
                                fieldString = "Global";
                                return true;
                            }
                            else
                            {
                                fieldString += element + "\n";
                                return false;
                            }
                        });

                        try
                        {
                            embed.addField('Enabled', fieldString, true);
                        }
                        catch (e)
                        {
                            console.log(e);
                        }
                    }
                    if (disabledChannels.length > 0)
                    {
                        fieldString = '';

                        disabledChannels.some(function(element, index) {
                            if (element === "Global")
                            {
                                fieldString = "Global";
                                return true;
                            }
                            else
                            {
                                fieldString += element + "\n ";
                                return false;
                            }
                        });

                        try
                        {
                            embed.addField('Disabled', fieldString, true);
                        }
                        catch (e)
                        {
                            console.log(e);
                        }
                    }
                    description = "Enable or Disable this command cross server, or in specific channels!";

                    description += '\n **Global Enable** `!settings '+param+' enable`';
                    description += '\n **Enable in Channel** `!settings '+param+' enable #channelname`';
                    description += '\n **Global Disable** `!settings '+param+' disable`';
                    description += '\n **Disable in Channel** `!settings '+param+' disable #channelName`';
                }
                else
                {
                    this.saveSettings(msg.guild);
                }
            } else {
                this.moduleNames.forEach(module => {
                    description += ':small_blue_diamond: **!settings '+module+'**  Enable/Disable [channels]\n';
                })

            }
            
            embed.setDescription(description+'\n To learn more about a command, use `!help <command>`');

            return msg.channel.send('', {embed});
        }
    }






    getDefaultSettings(guild)
    {
        if (!guild)
        {
            return;
        }
        var settings = {};
        settings.name = guild.name;
        settings.module = {};
        settings.admin = {};
        settings.admin.StoreChannels = [];
        this.modules.forEach(module => {
            var modulename = module.name.toLowerCase();
            settings.module[modulename] = {};
            settings.module[modulename].Global = (modulename === "settings" || modulename === "help");
            settings.module[modulename].EnabledChannels = [];
            settings.module[modulename].DisabledChannels = [];
        });

        return settings;
    }

    getSettings(guild)
    {
        if (!guild)
        {
            return;
        }
        if (!this._settings[guild.id])
        {
            var settingsPath = `./Settings/${guild.id}.json`;
            if (fs.existsSync(settingsPath))
            {
                console.log(`Loading settings for ${guild.name}(${guild.id})`);
                var data = fs.readFileSync(settingsPath, 'utf8');
                try
                {
                    var defaultSettings = this.getDefaultSettings(guild);
                    this._settings[guild.id] = JSON.parse(data);
                    this._settings[guild.id].admin = this._settings[guild.id].admin || {};

                    for (var key in defaultSettings.module)
                    {
                        if (!this._settings[guild.id].module[key])
                        {
                            this._settings[guild.id].module[key] = defaultSettings.module[key];
                        }
                    }
                    
                    for (var key in defaultSettings.admin)
                    {
                        if (!this._settings[guild.id].admin[key])
                        {
                            this._settings[guild.id].admin[key] = defaultSettings.admin[key];
                        }
                    }
                }
                catch (e)
                {
                    //Delete File
                    //Return recursion if file !exist
                    throw e;
                }
            }
            else
            {
                console.log(`Creating default settings for ${guild.name}(${guild.id})`);
                //READ FROM FILE IF EXISTS ELSE NEW
                this._settings[guild.id] = this.getDefaultSettings(guild);
            }
        }
        return this._settings[guild.id];
    }

    saveSettings(guild)
    {
        if (!guild)
        {
            return;
        }
        fs.writeFile(`./Settings/${guild.id}.json`, JSON.stringify(this.getSettings(guild)), 
            function(err) {
                if (err) {
                    return console.log(err);
                }
            }
        );
    }


}
module.exports = Settings;
