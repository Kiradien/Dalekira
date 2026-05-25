const rp = require("request-promise-native");
const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('anime');

class anime {
    constructor(modules) {
        this.name = "anime";
        this.commands = {
            anime: {
                aliases: [],
                inline: true,
                description: "Retrieve information about specified series.",
                help: 'Retrieve information about specified series including ratings, episode count, etc.',
                examples: ["!anime jojo"]
            }
        };
        //this.location = 'https://github.com/bra1n/judgebot';
        this.modules = modules;
        this.settingsModule = modules[0];


        this.Api = "https://kitsu.io/api/edge/anime?page[limit]=20&filter[text]="; //called in getApiCall
    }

    getApiCall(text)
    {
        return {
            method: 'GET',
            uri: this.Api + encodeURI(text),
            formData: {},
            headers: {
                'content-type': 'application/vnd.api+json'
            }//,
            //json: true
        };
    }

    generateEmbed(data, msg)
    {
        return new Promise(resolve => {
            let displayData = data[0];
            let embed = new Discord.RichEmbed();

            if (displayData)
            {
                embed.title = displayData.attributes.titles["en"];
                //displayData.attributes.averageRating
                embed.description = `**${displayData.attributes.episodeCount} episodes** *(${displayData.type})*
                ${displayData.attributes.synopsis}`;
                //embed.url = 
                if (displayData.attributes.averageRating)
                {
                    let value = displayData.attributes.averageRating;
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
                embed.setTimestamp();
                let FooterText = "!anime seriesname to search for more!";

                if (data.length == 20)
                {
                    FooterText = `${data.length - 1} or more other results found. You may need to refine your search parameters.`;
                }
                else if (data.length > 1)
                {
                    FooterText = `${data.length - 1} other results found.`;
                }

                embed.footer = {text: FooterText,
                    icon_url: "https://cdn.discordapp.com/emojis/413457407239520256.png?v=1"};

                if (displayData.attributes.posterImage)
                {
                    embed.thumbnail = {url: displayData.attributes.posterImage.medium || displayData.attributes.posterImage.large};
                }
                
                if (displayData.attributes.coverImage)
                {
                    embed.image = {url: displayData.attributes.coverImage.medium || displayData.attributes.coverImage.large};
                }
                embed.author = {
                    name: displayData.attributes.canonicalTitle,
                    //url: `https://kitsu.io/anime/${displayData.attributes.slug}`,
                    //icon_url: ""
                }
                if (displayData.attributes.slug)
                {
                    embed.author.url = `https://kitsu.io/anime/${displayData.attributes.slug}`;
                }
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
        msg.parameter = parameter;
        let me = this;
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
                resolve(JSON.parse(body).data);
            });
        });
    }

}
module.exports = anime;
