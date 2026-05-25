const rp = require("request-promise-native");
const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('UrbanDictionary');

class UrbanDictionary {
    constructor(modules) {
        this.name = "UrbanDictionary";
        this.commands = {
            urban: {
                aliases: ["urbanDictionary"],
                inline: true,
                description: "Get the Urban Dictionary definition for something",
                help: 'Enter text after the command to search Urban Dictionary',
                examples: ["!urban text", "!urbanDictionary text"]
            }
        };
        //this.location = 'https://github.com/bra1n/judgebot';
        this.modules = modules;
        this.settingsModule = modules[0];


        this.Api = "http://api.urbandictionary.com/v0/define?term="; //called in getApiCall
    }

    getApiCall(text)
    {
        return {
            method: 'GET',
            uri: this.Api + encodeURI(text),
            formData: {},
            headers: {
                //'content-type': 'application/vnd.api+json'
            },
            json: true
        };
    }

    generateEmbed(data, msg)
    {
        return new Promise(resolve => {
            let displayData = data[0];
            let embed = new Discord.RichEmbed();

            
            if (displayData)
            {
                embed.title = displayData.word;
                //displayData.attributes.averageRating
                embed.description = `${displayData.definition}`;
                embed.url = displayData.permalink;
                if (displayData.thumbs_up || displayData.thumbs_down)
                {
                    let value = (displayData.thumbs_up * 100) / (displayData.thumbs_up + displayData.thumbs_down);
                    //let red = parseInt(255 - (255 * 2 * Math.max((value - 50)/100, 0))).toString(16);
                    let red = Math.max(value - 50, 0);
                    red = parseInt(Math.max(255 - (2.55 * 2 * (red + ((red/35) * 15))) , 0));
                    
                    red = Math.min(red, 255).toString(16);
                    while (red.length < 2)
                    {
                        red = "0" + red;
                    }
                    let green = parseInt(Math.min(255 * (Math.max(value - 25, 0) * 2)/100, 255)).toString(16);
                    while (green.length < 2)
                    {
                        green = "0" + green;
                    }
                    let color = red + green + "00";
                    embed.color = parseInt(color, 16);
                }
                //embed.setTimestamp();
                embed.timestamp = displayData.written_on;
                let FooterText = `Submitted by user "${displayData.author}" on UrbanDictionary.com`;

                embed.footer = {
                    text: FooterText,
                    //icon_url: "https://cdn.discordapp.com/emojis/413457407239520256.png?v=1"
                    icon_url: "https://cdn.discordapp.com/attachments/467834737919262725/473054536420950017/favicon.png"
                };
            }
            else
            {
                embed.title = msg.parameter;
                embed.description = "No Results Found.";
                embed.setTimestamp();
                embed.color = 0xFF0000;
            }

            resolve(embed);
        });
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        let me = this;
        msg.parameter = parameter;
        this.retrieveData(parameter, msg)
            .then(data => {
                this.generateEmbed(data, msg)
                    .then(embed => {
                        return msg.channel.send('', embed);
                    }, err => log.error(err))
                    .then(sentMessage => {
                        if (data.length > 1) {
                            sentMessage.react('⬅').then(() => sentMessage.react('➡'));
                        }
                        

                        let collector = sentMessage.createReactionCollector(
                            ({emoji} , user) => ['⬅','➡'].indexOf(emoji.toString()) > -1 && user.id === msg.author.id,
                            {time: 300000, max: 100}
                        );
                        let settings = me.settingsModule.getSettings(msg.guild);
                        
                        collector.on('collect', reaction => {
                            if (reaction.message.guild && !settings["CanRemoveReactions"])
                            {
                                try
                                {
                                    reaction.users.forEach(user => {
                                        if (!user.bot)
                                        {
                                            reaction.remove(user);
                                        }
                                    });
                                }
                                catch (ex)
                                {
                                    console.log("Exception trying to remove reaction: " + ex);
                                    settings["CanRemoveReactions"] = true;
                                }
                            }

                            if(reaction.emoji.toString() === '⬅') {
                                data.unshift(data.pop());
                            } else if(reaction.emoji.toString() === '➡') {
                                data.push(data.shift());
                            } else {
                                // toggle zoom
                                //cards[0].zoom = !cards[0].zoom;
                            }
                            // edit the message to update the current card
                            this.generateEmbed(data, msg).then(embed => {
                                sentMessage.edit('', {embed});
                            });
                        });
                        
                        collector.on('end', () => {
                            sentMessage.clearReactions()
                                .then(message => {

                                }, err => {
                                    //log.error("Could not remove reactions.");
                                })
                        });



                    });
            });
    }
    
    retrieveData(parameter, msg)
    {
        return new Promise(resolve => {
            return rp(this.getApiCall(parameter)).then(body => {
                resolve(body.list);
            });
        });
    }

}
module.exports = UrbanDictionary;
