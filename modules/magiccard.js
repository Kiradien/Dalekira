const rp = require("request-promise-native");
const _ = require("lodash");
const Discord = require("discord.js");
const log = require("log4js").getLogger('card');
const cheerio = require("cheerio");

class MtgCardLoader {
    constructor(modules, fileMan) {
        this.settingsModule = modules[0];
        this.name = "magiccard";
        this.commands = {
            card: {
                aliases: ["mtgcard", "magiccard"],
                inline: true,
                description: "Search for an English Magic card by (partial) name, supports full Scryfall syntax",
                help: '',
                examples: ["!card iona", "!card t:creature o:flying", "!card goyf e:fut"]
            },
            price: {
                aliases: ["prices"],
                inline: true,
                description: "Show the price in USD, EUR and TIX for a card",
                help: '',
                examples: ["!price tarmogoyf"]
            },
            ruling: {
                aliases: ["rulings"],
                inline: true,
                description: "Show the Gatherer rulings for a card",
                help: '',
                examples: ["!ruling sylvan library"]
            }
            // ,legal: {
            //     aliases: ["legality"],
            //     inline: true,
            //     description: "Show the format legality for a card",
            //     help: '',
            //     examples: ["!legal divining top"]
            // }
        };
        this.cardApi = "https://api.scryfall.com/cards/search?q=";
        this.cardApiFuzzy = "https://api.scryfall.com/cards/named?fuzzy=";
        // Discord bots can use custom emojis globally, so we just reference these Manamoji through their code / ID
        // (currently hosted on the Judgebot testing discord)
        // @see https://github.com/scryfall/thopter/tree/master/manamoji
        this.manamojis = {
            "2":"467841495492329473",
            "0":"467841495664427025",
            "1":"467841495718690826",
            "6":"467841495827873803",
            "7":"467841495966154753",
            "9":"467841496020942859",
            "4":"467841496029200384",
            "20":"467841496121606156",
            "5":"467841496171675648",
            "15":"467841496184389655",
            "8":"467841496205361172",
            "10":"467841496234590238",
            "11":"467841496251629568",
            "18":"467841496368807937",
            "12":"467841496431853579",
            "14":"467841496456888320",
            "13":"467841496461082624",
            "3":"467841496473665546",
            "17":"467841496486379530",
            "19":"467841496519933962",
            "16":"467841496633311232",
            "bp":"467835704462934028", 
            "bg":"467835704508940289", 
            "b":"467835704630706176", 
            "br":"467835704693751809", 
            "gw":"467835704882364418", 
            "c":"467835704953667584", 
            "infinity":"467835705150668825", 
            "g":"467835705163382784", 
            "e":"467835705163382794", 
            "chaos":"467835705180028928", 
            "gp":"467835705184485376", 
            "rp":"467835705188679692", 
            "gu":"467835705205325824", 
            "hw":"467835705222103059", 
            "q":"467835705259982859", 
            "half":"467835705284886529", 
            "hr":"467835705301925898", 
            "ub":"467835705406521347", 
            "t":"467835705427755029", 
            "rg":"467835705448595457", 
            "r":"467835705519767562", 
            "s":"467835705545064469", 
            "rw":"467835705570099221", 
            "u":"467835705599459349", 
            "wu":"467835705645596693", 
            "y":"467835705704579074", 
            "up":"467835705729613825", 
            "z":"467835705733808129", 
            "w":"467835705825951764", 
            "wb":"467835705826213889", 
            "ur":"467835705838796801", 
            "wp":"467835705943654410", 
            "x":"467835705981403136", 
            "2u":"467835738424344577", 
            "2b":"467835738575339520", 
            "2r":"467835738625671178", 
            "2g":"467835738642448394", 
            "2w":"467835738726072330"
        };
        // embed border colors depending on card color(s)
        this.colors = {
            "W": 0xF8F6D8,
            "U": 0xC1D7E9,
            "B": 0x0D0F0F,
            "R": 0xE49977,
            "G": 0xA3C095,
            "GOLD": 0xE0C96C,
            "ARTIFACT": 0x90ADBB,
            "LAND": 0xAA8F84,
            "NONE": 0xDAD9DE
        };
        // cache for Discord permission lookup
        this.permissionCache = {};
    }

    getCommands() {
        return this.commands;
    }

    // replace mana and other symbols with actual emojis
    renderEmojis(text) {
        return text.replace(/{[^}]+?}/ig, match => {
            const code = match.replace(/[^a-z0-9]/ig,'').toLowerCase();
            return this.manamojis[code] ?  '<:'+(code.length < 2 ? code+'_':code)+':'+this.manamojis[code]+'>':'';
        });
    }

    // determine embed border color
    getBorderColor(card) {
        let color;
        if (!card.colors || card.colors.length === 0) {
            color = this.colors.NONE;
            if (card.type_line && card.type_line.match(/artifact/i)) color = this.colors.ARTIFACT;
            if (card.type_line && card.type_line.match(/land/i)) color = this.colors.LAND;
        } else if (card.colors.length > 1) {
            color = this.colors.GOLD;
        } else {
            color = this.colors[card.colors[0]];
        }
        return color;
    }

    // parse Gatherer rulings
    parseGathererRulings(gatherer) {
        const $ = cheerio.load(gatherer);
        const rulings = [];
        $('.rulingsTable tr').each((index,elem) => {
            rulings.push('**'+$(elem).find('td:nth-child(1)').text()+':** '+$(elem).find('td:nth-child(2)').text());
            if (rulings.join('\n').length > 2040) {
                rulings[rulings.length - 1] = '...';
                return false;
            }
        });
        return rulings.join('\n');
    }

    // generate description text from a card object
    generateDescriptionText(card) {
        const ptToString = (card) =>
            '**'+card.power.replace(/\*/g, '\\*') + "/" + card.toughness.replace(/\*/g, '\\*')+'**';

        const description = [];
        if (card.type_line) { // bold type line
            let type = `**${card.printed_type_line || card.type_line}** `;
            type += `(${card.set.toUpperCase()} ${_.capitalize(card.rarity)}`;
            type += `${card.lang && card.lang !== 'en' ? ' :flag_' + card.lang + ':':''})`;
            description.push(type);
        }
        if (card.oracle_text) { // reminder text in italics
            const text = card.printed_text || card.oracle_text;
            description.push(text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
        }
        if (card.flavor_text) { // flavor text in italics
            description.push('*' + card.flavor_text+'*');
        }
        if (card.loyalty) { // bold loyalty
            description.push('**Loyalty: ' + card.loyalty+'**');
        }
        if (card.power) { // bold P/T
            description.push(ptToString(card));
        }
        if (card.card_faces) {
            // split cards are special
            card.card_faces.forEach(face => {
                description.push('**'+face.type_line+'**');
                if (face.oracle_text) {
                    description.push(face.oracle_text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
                }
                if (face.power) {
                    description.push(ptToString(face));
                }
                description.push('');
            });
        }
        return description.join('\n');
    }

    // generate the embed card
    generateEmbed(cards, command, hasEmojiPermission) {
        return new Promise(resolve => {
            const card = cards[0];

            // generate embed title and description text
            // use printed name (=translated) over English name, if available
            let title = card.printed_name || card.name;

            if (card.mana_cost) {
                title += ' ' + card.mana_cost;
            }

            // DFC use card_faces array for each face
            if (card.layout === 'transform' && card.card_faces) {
                if (card.card_faces[0].mana_cost) {
                    title += ' ' + card.card_faces[0].mana_cost;
                }
                card.image_uris = card.card_faces[0].image_uris;
            }

            let description = this.generateDescriptionText(card);

            // are we allowed to use custom emojis? cool, then do so, but make sure the title still fits
            if(hasEmojiPermission) {
                title = _.truncate(this.renderEmojis(title), {length: 256, separator: '<'});
                description = this.renderEmojis(description);
            }

            // footer
            let footer = "Use !help to get a list of available commands.";
            if(cards.length > 1) {
                footer = (cards.length - 1) + ' other hits:\n';
                footer += cards.slice(1,6).map(cardObj => (cardObj.printed_name || cardObj.name)).join('; ');
                if (cards.length > 6) footer += '; ...';
            }

            // instantiate embed object
            const embed = new Discord.RichEmbed({
                title,
                description,
                footer: {text: footer},
                url: card.scryfall_uri,
                color: this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
                thumbnail: card.image_uris ? {url: card.image_uris.normal} : null, //could use small, however clicking on thumbnail is ideal way to expand.
                image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
            });

            // add pricing, if requested
            if (command.match(/^price/)) {
                let prices = [];
                if(card.usd) prices.push('$' + card.usd);
                if(card.eur) prices.push(card.eur + '€');
                if(card.tix) prices.push(card.tix + ' Tix');
                embed.addField('Prices', prices.join(' / ') || 'No prices found');
            }


            // add legalities, if requested
            //if (command.match(/^legal/)) {
            let legalities = (_.invertBy(card.legalities).legal || []).map(_.capitalize).join(', ');
            let restricted = (_.invertBy(card.legalities).restricted || []).map(_.capitalize).map(legality => legality + " : Restricted").join(', ');

            if (legalities)
            {
                legalities += ", " + restricted;
            }
            else
            {
                legalities = restricted;
            }

            embed.addField('Legal in', legalities || 'Nowhere');
            //}
            

            // add rulings loaded from Gatherer, if needed
            if(command.match(/^ruling/) && card.related_uris.gatherer) {
                rp(card.related_uris.gatherer).then(gatherer => {
                    embed.setAuthor('Gatherer rulings for');
                    embed.setDescription(this.parseGathererRulings(gatherer));
                    resolve(embed);
                });
            } else {
                resolve(embed);
            }
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
     * Fetch the cards from Scryfall
     * @param cardName
     * @returns {Promise<Object>}
     */
    getCards(cardName) {
        let requestPromise;
        requestPromise = new Promise((resolve, reject) => {
            rp({url: this.cardApi + encodeURIComponent(cardName + ' include:extras'), json: true}).then(body => {
                if(body.data && body.data.length) {
                    // sort the cards to better match the search query (issue #87)
                    body.data.sort((a, b) => this.scoreHit(b, cardName) - this.scoreHit(a, cardName));
                }
                resolve(body);
            }, () => {
                log.info('Falling back to fuzzy search for '+cardName);
                rp({url: this.cardApiFuzzy + encodeURIComponent(cardName), json: true})
                    .then(response => resolve({data: [response]}), reject);
            });
        });
        return requestPromise;
    }

    /**
     * Calculate the hit score for a card and a search query
     * @param card
     * @param query
     */
    scoreHit(card, query) {
        const name = (card.printed_name || card.name).toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameQuery = query.split(" ").filter(q => !q.match(/[=:()><]/)).join(" ").toLowerCase().replace(/[^a-z0-9]/g, '');
        let score = 0;
        if (name === nameQuery) {
            // exact match - to the top!
            score = 10000;
        } else if(name.match(new RegExp('^'+nameQuery))) {
            // match starts at the beginning of the name
            score = 1000 * nameQuery.length / name.length;
        } else {
            // match anywhere but the beginning
            score = 100 * nameQuery.length / name.length;
        }
        return score;
    }

    /**
     * Handle an incoming message
     * @param command
     * @param parameter
     * @param msg
     * @returns {Promise}
     */
    handleMessage(command, parameter, msg) {
        const cardName = parameter.toLowerCase();
        // no card name, no lookup
        if (!cardName) return;
        const permission = true; // assume we have custom emoji permission for now
        // fetch data from API
        this.getCards(cardName).then(body => {
            // check if there are results
            if (body.data && body.data.length) {
                // generate embed
                this.generateEmbed(body.data, command, permission).then(embed => {
                    return msg.channel.send('', {embed});
                }, err => log.error(err)).then(sentMessage => {
                    // add reactions for zoom and paging
                    sentMessage.react('🔍').then(() => {
                        if (body.data.length > 1) {
                            sentMessage.react('⬅').then(() => sentMessage.react('➡').then(() => sentMessage.react('🔒')));
                        }
                        else{
                            sentMessage.react('🔒');
                        }
                    });

                    let collector = sentMessage.createReactionCollector(
                        ({emoji} , user) => ['⬅','➡','🔍', '🔓', '🔒'].indexOf(emoji.toString()) > -1 && (user.id === msg.author.id || (user.id != msg.client.user.id && body.unlocked)),
                        {time: 300000, max: 100}
                    );
                    let settings = this.settingsModule.getSettings(msg.guild);
                    
                    collector.on('collect', (reaction, collector) => {
                        
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
                            body.data.unshift(body.data.pop());
                        } else if(reaction.emoji.toString() === '➡') {
                            body.data.push(body.data.shift());
                        } else if(reaction.emoji.toString() === '🔒') {
                            if (!body.unlocked)
                            {
                                body.unlocked = true;
                                sentMessage.react('🔓'); //Add New Reaction
                                if (!settings["CanRemoveReactions"])
                                {
                                    try
                                    {
                                        reaction.remove(); //Remove Existing
                                    }
                                    catch (ex)
                                    {
                                        console.log("Exception trying to remove reaction: " + ex);
                                        settings["CanRemoveReactions"] = true;
                                    }
                                }
                            }
                        } else if(reaction.emoji.toString() === '🔓') {
                            if ( !!body.unlocked)
                            {
                                body.unlocked = false;
                                sentMessage.react('🔒'); //Add New Reaction
                                if (!settings["CanRemoveReactions"])
                                {
                                    try
                                    {
                                        reaction.remove(); //Remove Existing
                                    }
                                    catch (ex)
                                    {
                                        console.log("Exception trying to remove reaction: " + ex);
                                        settings["CanRemoveReactions"] = true;
                                    }
                                }
                            }
                        } else if (reaction.emoji.toString() === '🔍') {
                            // toggle zoom
                            body.data[0].zoom = !body.data[0].zoom;
                        }

                        // edit the message to update the current card
                        this.generateEmbed(body.data, command, permission).then(embed => {
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
                    
                    // collector.on('remove', () => console.log('removed'));
                    // collector.on('dispose', () => console.log('disposed'));
                }, err => log.error(err));
            }
        }).catch(err => {
            let description = 'No cards matched `'+cardName+'`.';
            if (err.statusCode === 503) {
                description = 'Scryfall is currently offline, please try again later.'
            }
            return msg.channel.send('', {embed: new Discord.RichEmbed({
                title: 'Error',
                description,
                color: 0xff0000
            })});
        });
    }
}

module.exports = MtgCardLoader;
