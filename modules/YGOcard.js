const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");
const log = require("log4js").getLogger('YgoCard');
const cheerio = require("cheerio");
const stringSimilarity = require('string-similarity');

class YGOCardLoader {
    constructor() {
        this.name = "YGOcard";
        this.commands = {
            card: {
                aliases: ['yugicard', 'ygocard'],
                inline: true,
                description: "Search for an English Yu-gi-oh card by (partial) name",
                help: 'Pull information about a Yugioh card in chat',
                examples: ["!card Blue-Eyes"]
            }
            // ,price: {
            //     aliases: ["prices"],
            //     inline: true,
            //     description: "Show the price in USD, EUR and TIX for a card",
            //     help: '',
            //     examples: ["!price tarmogoyf"]
            // },
            // ruling: {
            //     aliases: ["rulings"],
            //     inline: true,
            //     description: "Show the Gatherer rulings for a card",
            //     help: '',
            //     examples: ["!ruling sylvan library"]
            // },
            // legal: {
            //     aliases: ["legality"],
            //     inline: true,
            //     description: "Show the format legality for a card",
            //     help: '',
            //     examples: ["!legal divining top"]
            // }
        };

        this.cardList = [];
        let requestPromise;
        requestPromise = new Promise((resolve, reject) => {
            rp({url: "https://www.ygohub.com/api/all_cards", json: true})
            .then(body => {
                if(body.data && body.data.length) {
                    // sort the cards to better match the search query (issue #87)
                    //body.data.sort((a, b) => this.scoreHit(b, cardName) - this.scoreHit(a, cardName));
                }
                resolve(body);
            }, () => {
            });
        });
        requestPromise.then(body =>
        {
            body.cards.forEach(card => {
                this.cardList[card] = null;
            });
            
            console.log("Yu-gi-oh cardlist retrieved.");
        });


        this.cardApi = "https://www.ygohub.com/api/card_info?name=";
        this.cardLevelEmoji = "468528533937979412";


        // cache for Discord permission lookup
        this.permissionCache = {};
    }

    getCommands() {
        return this.commands;
    }


    // generate description text from a card object
    generateDescriptionText(card) {

        const description = [];
        if (card.type) { // bold type line
            let type = `**${card.type}** `;
            if (card.species)
            {
                type += `${card.species} `;
            }
            if (card.attribute)
            {
                type += `[${_.capitalize(card.attribute)}]`;
            }
            //type += `${card.lang && card.lang !== 'en' ? ' :flag_' + card.lang + ':':''})`;
            description.push(type);
        }
        if (card.number) { // reminder text in italics
            const text = card.number;
            description.push(card.number);
        }
        if (card.text) { // flavor text in italics
            description.push('*' + card.text+'*');
        }
        
        if (card.attack || card.defense)
        {
            let cardStats = '**ATK/**' + (card.attack || 0) + "    **DEF**/" + (card.defense || 0) + '';
            //.replace(/\*/g, '\\*')

            description.push(cardStats);
        }
        
        return description.join('\n');
    }

    // generate the embed card
    generateEmbed(cards, command, hasEmojiPermission) {
        return new Promise(resolve => {
            this.getCard(cards[0])
                .then(retrCardObj =>
                    {
                        const card = retrCardObj;

                        // generate embed title and description text
                        // use printed name (=translated) over English name, if available
                        let title = card.name + " \n";

                        //console.log(card);
                        //console.log(card.name);
            
                        if (card.type)
                        {
                            //title += ` (${card.type})`
                        }
            
                        if (card.stars) {
                            if(hasEmojiPermission) {
                                let i;

                                let cardLevelEmojiFull = `<:sl:${this.cardLevelEmoji}>`;

                                if ((card.stars * cardLevelEmojiFull.length + title.length) < 256)
                                {
                                    for (i=0; i<card.stars; i++)
                                    {
                                        title += cardLevelEmojiFull;
                                    }
                                }
                                else
                                {
                                    title += `${cardLevelEmojiFull} x ${card.stars}`
                                }
                            }
                            else
                            {
                                title += ` ${card.stars} Stars`;
                            }

                        }
            
                        let description = this.generateDescriptionText(card);
            
                        // footer
                        let footer = "Use !help to get a list of available commands.";
                        if(cards.length > 1) {
                            footer = (cards.length - 1) + ' other hits:\n';
                            footer += cards.slice(1,6).join('; ');
                            if (cards.length > 6) footer += '; ...';
                        }

                        // instantiate embed object
                        const embed = new Discord.RichEmbed({
                            title,
                            description,
                            footer: {text: footer},
                            //url: NEED URL,
                            //color: this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
                            //thumbnail: card.image_path ? {url: card.image_path} : null, //could use thumbnail, however clicking on thumbnail is ideal way to expand.
                            //image: card.zoom && card.image_path ? {url: card.image_path} : null
                            image: {url: card.image_path}
                        });
            
                        resolve(embed);

                    }
                );
            //
        });
    }

    // disabled due to memory concerns
    // fetch permissions from Guild to use custom emojis
    // getEmojiPermission(msg) {
    //     return new Promise(resolve => {
    //         if (msg.guild && this.permissionCache[msg.guild.id] === undefined) {
    //             // in guild chat, fetch member role
    //             msg.guild.fetchMember(msg.client.user.id).then(member => {
    //                 if (member.permissions) {
    //                     this.permissionCache[msg.guild.id] = member.permissions.has('USE_EXTERNAL_EMOJIS');
    //                     resolve(this.permissionCache[msg.guild.id]);
    //                 } else {
    //                     resolve(true);
    //                 }
    //             });
    //         } else if(msg.guild) {
    //             // in guild chat, permission is cached
    //             resolve(this.permissionCache[msg.guild.id])
    //         } else {
    //             // otherwise assume we can use custom emoji
    //             resolve(true);
    //         }
    //     });
    // }

    /**
     * Fetch the matching cards from local list
     * @param cardName
     * @returns {Promise<Object>}
     */
    getCards(cardName) {
        let requestPromise;
        requestPromise = new Promise((resolve, reject) => {
            var cards = Object.keys(this.cardList)
            .filter(value => new RegExp(cardName.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .test(value.toLowerCase().replace(/[^a-z0-9]/g, ''))
            )
            .sort(function(a, b) {
                var valA = stringSimilarity.compareTwoStrings(a, cardName);
                var valB = stringSimilarity.compareTwoStrings(b, cardName);

                if (valA > valB)
                {
                    return -1;
                }
                else if (valB > valA)
                {
                    return 1;
                }
                else if (valA = valB)
                {
                    return 0;
                }
            });

            if (cards && cards.length > 0)
            {
                resolve(cards);
            }
            else
            {
                resolve(Promise.reject());
            }
        });
        return requestPromise;
    }
    
    /**
     * Fetch the matching exact card from API - no fuzzy searching.
     * @param card
     * @returns {Promise<Object>}
     */
    getCard(cardName) {
        let requestPromise;
        requestPromise = new Promise((resolve, reject) => {
            if (!!this.cardList[cardName])
            {
                resolve(this.cardList[cardName]);
            }
            else
            {
                rp({url: this.cardApi + encodeURIComponent(cardName), json: true}).then(body => {
                    if (body && body.status && body.status === 'success')
                    {
                        this.cardList[cardName] = body.card;
                        resolve(body.card);
                    }
                    else
                    {
                        resolve(Promise.reject);
                    }
                }, () => { 
                    resolve(Promise.reject()); 
                });
            }
        });
        return requestPromise;
    }

    /**
     * Handle an incoming message
     * @param command
     * @param parameter
     * @param msg
     * @returns {Promise}
     */
    handleMessage(command, parameter, msg) {
        const input = parameter;
        const permission = true;
        // no card name, no lookup
        if (!input) return;

        // this.getCards(input).then(cards => {
        //     if (cards && cards.length)
        //     {
        //         this.generateEmbed(cards, command, permission)
        //             .then(embed => {
        //                 return msg.channel.send('', {embed});
        //             }
            
        //         );

        //     }
        // }, () => {
        //     let description = 'No cards matched `'+parameter+'`.';

        //     return msg.channel.send('', {embed: new Discord.RichEmbed({
        //         title: 'Not Found',
        //         description,
        //         color: 0xff0000
        //     })});
        // }).catch(err => {
        //     let description = 'No cards matched `'+parameter+'`.';

        //     return msg.channel.send('', {embed: new Discord.RichEmbed({
        //         title: 'Error',
        //         description,
        //         color: 0xff0000
        //     })});
        // });


        this.getCards(input).then(cards => {
            if (cards && cards.length)
            {
                this.generateEmbed(cards, command, permission)
                    .then(embed => {
                        return msg.channel.send('', {embed});
                    }, err => log.error(err))
                    .then(sentMessage => {
                        // add reactions for zoom and paging
                        // sentMessage.react('🔍')
                        // .then(() => {
                        // });
                        if (cards.length > 1) {
                            sentMessage.react('⬅').then(() => sentMessage.react('➡'));
                        }

                        let collector = sentMessage.createReactionCollector(
                            ({emoji} , user) => ['⬅','➡','🔍'].indexOf(emoji.toString()) > -1 && user.id === msg.author.id,
                            {time: 300000, max: 100}
                        );
                        
                        collector.on('collect', reaction => {
                            if(reaction.emoji.toString() === '⬅') {
                                cards.unshift(cards.pop());
                            } else if(reaction.emoji.toString() === '➡') {
                                cards.push(cards.shift());
                            } else {
                                // toggle zoom
                                //cards[0].zoom = !cards[0].zoom;
                            }
                            // edit the message to update the current card
                            this.generateEmbed(cards, command, permission).then(embed => {
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

                    }, err => log.error(err));
            }
        }, () => {
            let description = 'No cards matched `'+parameter+'`.';

            return msg.channel.send('', {embed: new Discord.RichEmbed({
                title: 'Not Found',
                description,
                color: 0xff0000
            })});
        }).catch(err => {
            let description = 'No cards matched `'+parameter+'`.';

            return msg.channel.send('', {embed: new Discord.RichEmbed({
                title: 'Error',
                description,
                color: 0xff0000
            })});
        });

        
    }



    
    // handleMessage(command, parameter, msg) {
    //     const input = parameter;
    //     const permission = true; // assume we have custom emoji permission for now
    //     // no card name, no lookup
    //     if (!input) return;






    //     const cardName = parameter.toLowerCase();
    //     // no card name, no lookup
    //     if (!cardName) return;
    //     const permission = true; // assume we have custom emoji permission for now
    //     // fetch data from API
    //     this.getCards(cardName).then(body => {
    //         // check if there are results
    //         if (body.data && body.data.length) {
    //             // generate embed

    //             this.generateEmbed(body.data, command, permission)
 
    //             .then(embed => {
    //                 return msg.channel.send('', {embed});
    //             }
                
                
                
    //             , err => log.error(err)).then(sentMessage => {
    //                 // add reactions for zoom and paging
    //                 // sentMessage.react('🔍')
    //                 // .then(() => {
    //                 // });
    //                 if (body.data.length > 1) {
    //                     sentMessage.react('⬅').then(() => sentMessage.react('➡'));
    //                 }
    //                 sentMessage.createReactionCollector(
    //                     ({emoji} , user) => ['⬅','➡','🔍'].indexOf(emoji.toString()) > -1 && user.id === msg.author.id,
    //                     {time: 60000, max: 20}
    //                 ).on('collect', reaction => {
    //                     if(reaction.emoji.toString() === '⬅') {
    //                         body.data.unshift(body.data.pop());
    //                     } else if(reaction.emoji.toString() === '➡') {
    //                         body.data.push(body.data.shift());
    //                     } else {
    //                         // toggle zoom
    //                         //body.data[0].zoom = !body.data[0].zoom;
    //                     }
    //                     // edit the message to update the current card
    //                     this.generateEmbed(body.data, command, permission).then(embed => {
    //                         sentMessage.edit('', {embed});
    //                     });
    //                 });
    //             }, err => log.error(err));
    //         }
    //     }).catch(err => {
    //         let description = 'No cards matched `'+cardName+'`.';
    //         if (err.statusCode === 503) {
    //             description = 'Scryfall is currently offline, please try again later.'
    //         }
    //         return msg.channel.send('', {embed: new Discord.RichEmbed({
    //             title: 'Error',
    //             description,
    //             color: 0xff0000
    //         })});
    //     });
    // }



}

module.exports = YGOCardLoader;
