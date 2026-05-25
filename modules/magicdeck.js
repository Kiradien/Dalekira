const rp = require("request-promise-native");
const _ = require('lodash');
const Discord = require('discord.js');

class magicdeck {
    constructor(modules, fileMan) {
        this.settingsModule = modules[0];
        this.name = "magicdeck";
        this.commands = {
            mtgDeck: {
                aliases: ["magicdeck", "decklist"],
                inline: false,
                multiline: true,
                description: "Parse MTG Arena exported decklists into a readable format.",
                help: 'Paste your decklist, link to a website or reference a user after calling this command!',
                examples: [`!decklist 4 Isolated Chapel (DAR) 241
                                      2 Ifnir Deadlands (HOU) 179`, 
                ' --- ',
                "!decklist https://www.mtggoldfish.com/deck/1211314", 
                "!decklist https://aetherhub.com/Deck/Public/27668",
                "!decklist https://tappedout.net/mtg-decks/03-10-18-gw-elves/",
                "!decklist @username #channel",
                "!decklist #channel"]
            }
        };
        this.fileMan = fileMan;
        this.cardList = this.fileMan.getData("mtgCards", "_cards", {});
        this.cardListDuration = (1 * 1000 * 60 * 60 * 24 * 30) * 2;

        this.modules = modules;
        this.emojis = [];
        this.emojis["Land"] = "🏝";
        this.emojis["Creature"] = "🦏";
        this.emojis["Planeswalker"] = "🦏";
        this.emojis["Sorcery"] = "☄";
        this.emojis["Instant"] = "💥";
        this.emojis["Artifact"] = "💎";
        this.emojis["Enchantment"] = "✨";
        this.emojis["Sideboard"] = "🅱";

        this.emojis["List"] = "🗒️";
        this.emojis["Dashboard"] = "📙";

        let emojis = this.emojis;
        
        this.reverseEmojis = Object.keys(this.emojis).reduce(function(obj,key){
            obj[emojis[key]] = key;
            return obj;
         },{});
         
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

        //Look for the string!
        this.regExpPattern = `(\\d+) ([\\w\\',\\-\\s/]+?)\\s\\((.*?)\\)\\s(\\d+)?`;
        this.regExpObject = new RegExp(this.regExpPattern, 'ig');
        
        this.mtgGoldfishPattern = '.*mtggoldfish\.com.*(?:/| )(\\d+)';
        this.aetherHubPattern = '.*aetherhub\.com.*(?:/| |(?:id=))(\\d+)';
        this.streamDeckerPattern = ".*streamdecker.com.*deck\/([a-z0-9]+)";
        this.tappedOutPattern = ".*tappedout.net/mtg-decks/([0-9\-a-z]+)";

        this.allRegExpPatterns = `(${this.regExpPattern})|(${this.mtgGoldfishPattern})|(${this.aetherHubPattern})|(${this.streamDeckerPattern})|(${this.tappedOutPattern})`;
        this.matchesAnyRegex = new RegExp(this.allRegExpPatterns, 'ig');

        this.cardsAdded = false;
    }
    

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg, callingMsg) {
        let commandIndex = msg.content.indexOf(command);

        if (!callingMsg)
        {
            callingMsg = msg;
        }

        if (commandIndex > -1)
        {
            parameter = msg.content.slice(commandIndex+command.length, msg.content.length);
        }

        if (!parameter)
        {
            if (msg.guild)
            {
                let settings = this.settingsModule.getSettings(msg.guild);
                parameter = settings.module["magicdeck"].defaultDeck;
            }
        }

        if (parameter)
        {
            let deck = {};
            let parameters = parameter.trim().split(" ");
            deck.setAsDefault = false;

            if (( msg.author.id === callingMsg.author.id && msg.member 
                    && (msg.member.hasPermission("ADMINISTRATOR") || msg.member.hasPermission("MANAGE_GUILD") || msg.author.id === '113803878322929664' ))
                 && parameters[0].toLowerCase() === 'default')
            {
                deck.setAsDefault = true;
                parameters.shift();

                parameter = parameters.join(" ");
                if (msg.guild)
                {
                    let settings = this.settingsModule.getSettings(msg.guild);
                    settings.module["magicdeck"].defaultDeck = parameter;
                    this.settingsModule.saveSettings(msg.guild);
                }
            }
            
            //deck.mainboard = [];
            //deck.sideboard = [];
            deck.cards = [];
            deck.importText = parameter;
            deck.regExpPattern = "";
            
            deck.apiPrefix = "https://api.scryfall.com/cards/search?q=name:/^(";
            deck.apiSuffix = ")/";

            deck.title = "";
            deck.author = msg.author.username;
            deck.displayCards = [];
            deck.showDashboard = true;
            deck.showImport = false;
            deck.show = {};
            deck.colors = [];

            let match;
            
            var queries = parameter.match(this.regExpObject);

            if (!!queries)
            {
                let lines = parameter.split('\n\n');

                while (!!lines[0] && !lines[0].match(this.regExpObject))
                {
                    lines.shift();
                }

                if (!lines[0])
                {
                    //fallback to default
                    lines = parameter.split('\n\n'); 
                }
                
                while (match = this.regExpObject.exec(lines[0]))
                {
                    // console.log("----------------------------------");
                    // console.log(match);
                    let cardObj = {count: parseInt(match[1]), name:match[2], set:match[3]};
                    //deck.mainboard.push(cardObj);
                    //console.log(cardObj.name);
                    
                    let cleanCardName = this.CleanCardName(cardObj.name);
                    let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                    cardObj2.mainboard += cardObj.count;
                
                    deck.cards[cleanCardName]  = cardObj2;
                }
                if (!!lines[1])
                {
                    //deck.importText += "\n" + lines[1].match(this.regExpObject).join("\n");
                    while (match = this.regExpObject.exec(lines[1]))
                    {
                        let cardObj = {count: parseInt(match[1]), name:match[2], set:match[3]};
                        //deck.sideboard.push(cardObj);
                    
                        let cleanCardName = this.CleanCardName(cardObj.name);
                        let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                        cardObj2.sideboard += cardObj.count;
                    
                        deck.cards[cleanCardName]  = cardObj2;
                    }
                }
                
                return this.sendMsg(msg, '', parameter, deck, callingMsg);
            }
            else
            {
                //this.aetherHubRegExpObject = new RegExp(this.aetherHubPattern, 'ig');
                //this.mtgGoldfishRegExpObject = new RegExp(this.mtgGoldfishPattern, 'ig');
                //this.streamDeckerRegExpObject = new RegExp(this.streamDeckerPattern, 'ig');

                let goldfishId = new RegExp(this.mtgGoldfishPattern, 'ig').exec(parameter);
                let aetherHubId = new RegExp(this.aetherHubPattern, 'ig').exec(parameter);
                let streamDeckerId = new RegExp(this.streamDeckerPattern, 'ig').exec(parameter);
                let tappedOutId = new RegExp(this.tappedOutPattern, 'ig').exec(parameter);

                if (parameters[0].toLowerCase() === "streamdecker" && !!parameters[1])
                {
                    this.retrieveDataStreamDecker(parameters[1], deck).then(result => {
                        deck = result;
                        return this.sendMsg(msg, '', parameter, deck, callingMsg);
                    }, () => {
                        console.log("Failed to retrieve list!");
                    });
                }
                else if (streamDeckerId && streamDeckerId.length > 1)
                {
                    this.retrieveDataStreamDeckerDeck(streamDeckerId[1], deck).then(result => {
                        deck = result;
                        return this.sendMsg(msg, '', parameter, deck, callingMsg);
                    }, () => {
                        console.log("Failed to retrieve list!");
                    });
                }
                else if (goldfishId && goldfishId.length > 1)
                {
                    goldfishId = goldfishId[1];
                    //console.log("Recognized MTG Goldfish. Retrieving.");
                    this.retrieveDataMtgGoldfish(goldfishId, deck).then(result => {
                        console.log("MTG Goldfish Data Retrieved.");
                        deck = result;

                        if (msg.embeds && msg.embeds[0] && msg.embeds[0].title)
                        {
                            deck.title = " " + msg.embeds[0].title;
                        }

                        return this.sendMsg(msg, '', parameter, deck, callingMsg);
                    }, () => {
                        console.log("Failed to retrieve list!");
                    });
                }
                else if (aetherHubId && aetherHubId.length > 1)
                {
                    aetherHubId = aetherHubId[1];
                    
                    this.retrieveGenericMTGAFormat(`https://aetherhub.com/Deck/FetchMtgaDeck?deckId=${aetherHubId}`, deck)
                        .then(result => {
                            deck = result;
                            deck.author = "Aetherhub";
                            deck.url = `https://aetherhub.com/Deck/Public/${aetherHubId}`;

                            if (msg.embeds && msg.embeds[0] && msg.embeds[0].title)
                            {
                                deck.title = " " + msg.embeds[0].title;
                            }

                            return this.sendMsg(msg, '', parameter, deck, callingMsg);
                        }, () => {
                            console.log("Failed to retrieve list!");
                        });
                }
                else if (tappedOutId && tappedOutId.length > 1)
                {
                    this.retrieveDataTappedOut(tappedOutId[1], deck).then(result => {
                        deck = result;
                        return this.sendMsg(msg, '', parameter, deck, callingMsg);
                    }, () => {
                        console.log("Failed to retrieve list!");
                    });


                }
                else if (msg.mentions.users.size > 0)
                {
                    let user = msg.mentions.users.last();
                    let channel = msg.channel;
                    if (msg.mentions.channels.size > 0)
                    {
                        channel = msg.mentions.channels.last();
                    }
                    let fetchQuery = { limit: 100 };

                    return this.fetchLastFromUser(command, channel, user, fetchQuery, 0, 10, msg);
                }
                else if (msg.mentions.channels.size > 0)
                {
                    let channel = msg.mentions.channels.last();
                    let fetchQuery = { limit: 100 };
                    return this.fetchLastFromUser(command, channel, null, fetchQuery, 0, 10, msg);
                }
                else if (parameter.match(".*mtggoldfish.*/archetype/"))
                {
                    return this.sendMsg(msg, 'Cannot create decklist from Archetype; please link a regular deck.', parameter, null, callingMsg);
                }
                else
                {
                    console.log("Reached endpoint of standard if-else structure.");
                    return this.sendMsg(msg, '', parameter, null, callingMsg);
                }
            }

        }
        else
        {
            return this.sendMsg(msg, '', parameter, null, callingMsg);
            //NO PARAMETER
        }
    }

    sendMsg(msg, text, parameter, deck, callingMsg)
    {
        if (!callingMsg)
        {
            console.log("callingMsg was null or empty, defaulting to msg.")
            callingMsg = msg;
        }
        console.log("SendMsg successfully called for Decklist.");
        if (!deck || !!deck.failureMessage)
        {
            let failureMessage = "Failed to generate deck object. \nDecklist must be called with a supported url or cards need to be in the following format:\n!decklist 4 Isolated Chapel (DAR) 241";
            if (!!deck)
            {
                failureMessage = deck.failureMessage;
            }

            let embed = new Discord.RichEmbed({
                title: "Error",
                description: failureMessage,
                footer: {text: "Type !help decklist for examples of appropriate formats.", 
                    icon_url: "https://cdn.discordapp.com/emojis/413457407239520256.png?v=1"},
                //url: card.scryfall_uri,
                //color: this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
                //thumbnail: card.image_uris ? {url: card.image_uris.normal} : null, //could use small, however clicking on thumbnail is ideal way to expand.
                //image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
            });
    
            return msg.channel.send(text, embed);
        }
        else if (deck && deck.cards && Object.keys(deck.cards).length > 0)
        {
            let expiryTime = new Date().getTime() - this.cardListDuration;
            let cardNameRegexes = Object.keys(deck.cards)
                .filter(card => !this.cardList[card] 
                                || !this.cardList[card].updated 
                                || (this.cardList[card].updated < expiryTime))
                .map(card => `(${deck.cards[card].name})`);
            cardNameRegexes = cardNameRegexes.map(function(e,i){
                return i%10 === 0 ? cardNameRegexes.slice(i, i+10).join('|') : null;
            }).filter(e => e);

            return this.retrieveData(deck, cardNameRegexes, 0).then(result => {
                
                //Generate attachment
                let cards = deck.cards;
                let mainboardCards = Object.keys(cards).filter(cardName => cards[cardName].mainboard > 0)
                    .map(item => {
                    let card = this.cardList[item];
                    if (!card)
                    {
                        console.log(item);
                    }
                    return `${cards[item].mainboard} ${card.data.name} (${card.data.set.toUpperCase()}) ${card.data.collector_number}`;
                    }).join("\r\n");
                let sideboardCards = Object.keys(cards).filter(cardName => cards[cardName].sideboard > 0)
                    .map(item => {
                        let card = this.cardList[item];
                        return `${cards[item].sideboard} ${card.data.name} (${card.data.set.toUpperCase()}) ${card.data.collector_number}`;
                    }).join("\r\n");

                deck.importText = `${mainboardCards}\r\n\r\n${sideboardCards}`;
                deck.importAttachment = { attachment: Buffer.from(deck.importText), name: "mtgArenaImport.txt" };

                let cardsWithoutIds = Object.keys(cards)
                    .filter(item => cards[item].data.multiverse_ids.length == 0)
                    .map(item => item);

                if (cardsWithoutIds.length > 0)
                {
                    console.log(`Cards found without Multiverse Id:`);
                    console.log(cardsWithoutIds);
                }
                 deck.deckCode = Object.keys(cards).filter(item => cards[item].data.multiverse_ids.length > 0)
                    .map(item => {
                         return `${cards[item].data.multiverse_ids[0]}a${cards[item].sideboard || ""}a${cards[item].mainboard || ""}`;
                     });

                 deck.deckCode = deck.deckCode.map(arrayItem => {
                     return this.convertBase(arrayItem, 11, 75);
                 }).join("|");

                 deck.sIds = Object.keys(cards)
                    .filter(item => cards[item].data.multiverse_ids.length == 0)
                    .map(item => cards[item].data.id).join("|");

                 //Call URL from bot to attempt trigger of deck refresh on site.
                 rp({url: `http://mtg.kiradien.com?code=${deck.deckCode}&sIds=${deck.sIds}`, json: true});

                 //console.log(deck.deckCode);
                
                if (!!callingMsg && !!callingMsg.channel)
                {
                    //Generate Embedded message
                    this.generateEmbed(deck, parameter, msg).then(embed => {
                        return this.sendMsgInner(msg, text, parameter, embed, deck, callingMsg);
                    });
                }
                else
                {
                    console.log("Message Object does not exist.");
                    //console.log(deck.cards);
                }
            });
        }
        
        let embed = new Discord.RichEmbed({
            title: "Error",
            description: "Decklist is in incorrect format.",
            footer: {text: "Type !help decklist for examples of appropriate formats.", 
                icon_url: "https://cdn.discordapp.com/emojis/413457407239520256.png?v=1"},
            //url: card.scryfall_uri,
            //color: this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
            //thumbnail: card.image_uris ? {url: card.image_uris.normal} : null, //could use small, however clicking on thumbnail is ideal way to expand.
            //image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
        });

        if (!!callingMsg && !!callingMsg.channel)
        {
            return msg.channel.send(text, embed);
        }
    }

    sendMsgInner(msg, text, parameter, embed, deck, callingMsg)
    {
        if (!!deck.importAttachment)
        {
            embed.files = embed.files || [];
            embed.files.push(deck.importAttachment);
        }

        return callingMsg.channel.send(text, embed).then(sentMsg => {
            //if (msg.deletable) msg.delete();

            // sentMsg.react(this.emojis["List"])
            //     .then(() => );
            sentMsg.react('⬅')
            .then(() => sentMsg.react('➡')
                .then(() => 
                {
                    let keys = Object.keys(deck.cardTypes);
                    this.messageReact(deck, sentMsg, keys);
                })
            );


            let collector = sentMsg.createReactionCollector(
                ({emoji} , user) => Object.keys(this.reverseEmojis)
                    .concat(['⬅','➡', '🔓', '🔒'])
                    .indexOf(emoji.toString()) > -1 
                        && (!user.bot && user.id === callingMsg.author.id 
                            || (!user.bot && user.id != callingMsg.client.user.id && deck.unlocked)
                        ),
                {time: 600000, max: 100}
            );
            let settings = this.settingsModule.getSettings(msg.guild);
            
            collector.on('collect', (reaction, collector) => {
                
                if (reaction.message.guild && !settings["CanRemoveReactions"])
                {
                    try
                    {
                        //DEBUG
                        //console.log("DEBUG: Removing Reactions");
                        reaction.users.forEach(user => {
                            if (!user.bot)
                            {
                                reaction.remove(user);
                            }
                        });
                        //console.log("DEBUG: Reactions Removed");
                    }
                    catch (ex)
                    {
                        console.log("Exception trying to remove reaction: " + ex);
                        settings["CanRemoveReactions"] = true;
                    }
                }
                
                if(reaction.emoji.toString() === '⬅') {
                    deck.displayCards.unshift(deck.displayCards.pop());
                } else if(reaction.emoji.toString() === '➡') {
                    deck.displayCards.push(deck.displayCards.shift());
                } else if(reaction.emoji.toString() === '🔒') {
                    if (!deck.unlocked)
                    {
                        deck.unlocked = true;
                        sentMsg.react('🔓'); //Add New Reaction

                        
                        if (!settings["CanRemoveReactions"])
                        {
                            try
                            {
                                //DEBUG
                                //console.log("DEBUG: Removing Reactions");
                                reaction.remove(); //Remove Existing
                                //console.log("DEBUG: Reactions Removed");
                            }
                            catch (ex)
                            {
                                console.log("Exception trying to remove reaction: " + ex);
                                settings["CanRemoveReactions"] = true;
                            }
                        }
                    }
                } else if(reaction.emoji.toString() === '🔓') {
                    if ( !!deck.unlocked)
                    {
                        deck.unlocked = false;
                        sentMsg.react('🔒'); //Add New Reaction
                        if (!settings["CanRemoveReactions"])
                        {
                            try
                            {
                                //DEBUG
                                //console.log("DEBUG: Removing Reactions");
                                reaction.remove(); //Remove Existing
                                //console.log("DEBUG: Reactions Removed");
                            }
                            catch (ex)
                            {
                                console.log("Exception trying to remove reaction: " + ex);
                                settings["CanRemoveReactions"] = true;
                            }
                        }
                    }
                } else if (this.reverseEmojis[reaction.emoji.toString()]) {
                    let emojiName = this.reverseEmojis[reaction.emoji.toString()];
                    
                    if (deck.show[emojiName])
                    {
                        deck.showDashboard = true;
                        deck.show = {};
                    }
                    else
                    {
                        deck.show = {};
                        deck.show[emojiName] = true;
                        deck.showDashboard = false;
                        //TODO:::
                        deck.displayCards = deck.cardTypes[emojiName] || [];
                        if (emojiName == "Planeswalker")
                        {
                            deck.displayCards = deck.displayCards.concat(deck.cardTypes["Creature"] || []);
                        }
                    }
                }

                // edit the message to update the current card
                this.generateEmbed(deck, parameter, msg).then(embed => {
                    sentMsg.edit('', {embed});
                });
            });

            collector.on('end', () => {
                sentMsg.clearReactions()
                    .then(message => {
                        deck.showDashboard = true;
                        this.generateEmbed(deck, parameter, msg).then(embed => {
                            sentMsg.edit('', {embed});
                        });
                    }, err => {
                        //log.error("Could not remove reactions.");
                    })
            });



        });
    }

    messageReact(deck, msg, keys)
    {
        let key = keys.shift();
        if (key && deck.cardTypes[key] && deck.cardTypes[key].length > 0)
        {
            if (deck.cardTypes[key].length > 0 && this.emojis[key])
            {
                msg.react(this.emojis[key])
                    .then(() => this.messageReact(deck, msg, keys));
            }
            else if (!!this.emojis[key])
            {
                console.log("Not found! " + key + " " + this.emojis[key]);
            }
        }
        else
        {
            msg.react('🔒');
        }
    }

    retrieveGenericMTGAFormat(callURI, deck)
    {
        return new Promise(resolve => {
            rp({url: callURI, json: true}).then(body => {
                
                let lines = body.split('\n\n');
                let match;

                while (match = this.regExpObject.exec(lines[0]))
                {
                    let cardObj = {count: parseInt(match[1]), name:match[2], set:match[3]};
                    //deck.mainboard.push(cardObj);
                    //console.log(cardObj.name);
                    
                    let cleanCardName = this.CleanCardName(cardObj.name);
                    let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                    cardObj2.mainboard += cardObj.count;
                
                    deck.cards[cleanCardName]  = cardObj2;
                }
                if (!!lines[1])
                {
                    //deck.importText += "\n" + lines[1].match(this.regExpObject).join("\n");
                    while (match = this.regExpObject.exec(lines[1]))
                    {
                        let cardObj = {count: parseInt(match[1]), name:match[2], set:match[3]};
                        //deck.sideboard.push(cardObj);
                    
                        let cleanCardName = this.CleanCardName(cardObj.name);
                        let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                        cardObj2.sideboard += cardObj.count;
                    
                        deck.cards[cleanCardName]  = cardObj2;
                    }
                }

                resolve(deck);
                //.forEach(card => {
                //});
            }, () => {
                console.log("Failed to retrieve Generic MTGA list!");
            })
        });
    }

    retrieveDataStreamDecker(userId, deck)
    {
        let callURI = `https://www.streamdecker.com/api/user/current/extension/${userId}`;
        return new Promise(resolve => {
            rp({url: callURI, json: true}).then(body => {
                deck.author = body.data.decks[0].userProfile.displayName;
                deck.url = `http://www.streamdecker.com/deck/${body.data.decks[0].deckLink}`;
                deck.title = " " + body.data.decks[0].name;
                deck.cards = [];
                let cards = body.data.decks[0].cardList.map(card => { return { mainboard:card.main, sideboard:card.sideboard, name:card.name }; });
                for (var cardId in cards)
                {
                    let cleanCardName = this.CleanCardName(cards[cardId].name);
                    deck.cards[cleanCardName] = cards[cardId];
                }
                resolve(deck);
                //.forEach(card => {
                //});
            }, () => {
                console.log("Failed to retrieve Streamdecker list!");
            })
        });
    }

    retrieveDataStreamDeckerDeck(deckId, deck)
    {
        let callURI = `http://www.streamdecker.com/api/deck/${deckId}`;
        return new Promise(resolve => {
            rp({url: callURI, json: true}).then(body => {
                //console.log(body);
                deck.author = body.data.userProfile.displayName;
                deck.url = `http://www.streamdecker.com/deck/${deckId}`;
                deck.title = " " + body.data.name;
                deck.cards = [];
                let cards = body.data.cardList.map(card => { return { mainboard:card.main, sideboard:card.sideboard, name:card.name }; });
                for (var cardId in cards)
                {
                    let cleanCardName = this.CleanCardName(cards[cardId].name);
                    deck.cards[cleanCardName] = cards[cardId];

                    cards[cardId].name = cards[cardId].name.replaceAll(" /", "/").replaceAll("/ ", "/").replaceAll("//", "/").replaceAll("/", " // ");
                }

                resolve(deck);
                //.forEach(card => {
                //});
            }, () => {
                console.log("Failed to retrieve Streamdecker Deck list!");
            })
        });
    }

    retrieveDataTappedOut(deckId, deck)
    {
        let callURI = `http://tappedout.net/api/collection:deck/${deckId}/board/?format=json`;
        return new Promise(resolve => {
            rp({url: callURI, json: true}).then(body => {
                //console.log(body.results);
                deck.author = "TappedOut";
                deck.url = `https://tappedout.net/mtg-decks/${deckId}`;
                deck.cards = [];
                //deck.title = " " + body.data.name;

                let cards = [];
                cards = cards.concat(body.results.filter(card => card.b == "main").map(card => { return { mainboard: card.qty, name: card.name }; }));
                cards = cards.concat(body.results.filter(card => card.b != "main").map(card => { return { sideboard: card.qty, name: card.name }; }));
                
                for (var cardId in cards)
                {
                    let cleanCardName = this.CleanCardName(cards[cardId].name);

                    if (cleanCardName == "Find")
                    {
                        //console.log(cards[cardId]);
                    }

                    if (!deck.cards[cleanCardName])
                    {
                        deck.cards[cleanCardName] = cards[cardId];
                        deck.cards[cleanCardName].mainboard = deck.cards[cleanCardName].mainboard || 0;
                        deck.cards[cleanCardName].sideboard = deck.cards[cleanCardName].sideboard || 0;
                    }
                    else
                    {
                        deck.cards[cleanCardName].mainboard += cards[cardId].mainboard || 0;
                        deck.cards[cleanCardName].sideboard += cards[cardId].sideboard || 0;
                    }

                    cards[cardId].name = cards[cardId].name.replaceAll(" /", "/").replaceAll("/ ", "/").replaceAll("//", "/").replaceAll("/", " // ");
                }
                resolve(deck);
                //.forEach(card => {
                //});
            }, () => {
                console.log("Failed to retrieve TappedOut Deck list!");
            })
        });
    }

    retrieveDataMtgGoldfish(id, deck)
    {
        let callURI = `https://www.mtggoldfish.com/deck/download/${id}`;
        return new Promise(resolve => {
            rp({url: callURI}).then(body => {
                let boards = body.split('\r\n\r\n');
                let match;
                let regExpPattern = `(\\d+) (.*)`;
                let regExpObject = new RegExp(regExpPattern, 'ig');
                deck.cards = [];
                //console.log(boards);
                
                while (match = regExpObject.exec(boards[0]))
                {
                    let cardObj = { count: parseInt(match[1]), name:match[2].replaceAll(" /", "/").replaceAll("/ ", "/").replaceAll("//", "/").replaceAll("/", " // ") };

                    let cleanCardName = this.CleanCardName(cardObj.name);
                    let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                    cardObj2.mainboard += cardObj.count;
                
                    deck.cards[cleanCardName]  = cardObj2;
                }

                if (!!boards[1])
                {
                    //console.log("Sideboard Found!");
                    while (match = regExpObject.exec(boards[1]))
                    {
                        let cardObj = { count: parseInt(match[1]), name:match[2] };
                        let cleanCardName = this.CleanCardName(cardObj.name);
                        //console.log("Adding '"+ cleanCardName + "' to Sideboard");
                    
                        let cardObj2 = deck.cards[cleanCardName] || { mainboard:0, sideboard:0, name:cardObj.name };
                        cardObj2.sideboard += cardObj.count;
                    
                        deck.cards[cleanCardName]  = cardObj2;
                    }
                }



                deck.author = "MTG Goldfish";
                deck.url = `https://www.mtggoldfish.com/deck/${id}`;
                //deck.title = " " + body.data.decks[0].name;


                resolve(deck);
                //.forEach(card => {
                //});
            }, () => {
                deck.failureMessage = "Failed to retrieve MTG Goldfish list!";
                console.log(deck.failureMessage);
                resolve(deck);
            })
        });
    }

    retrieveData(deck, array, index, msg, count)
    {
        count = count || 0;
        return new Promise(resolve => {

            let now = new Date().getTime();
            let expiryTime = now - this.cardListDuration;
            let cardNameRegexes = Object.keys(deck.cards)
                .filter(card => !this.cardList[card] 
                                || !this.cardList[card].updated 
                                || (this.cardList[card].updated < expiryTime))

            if (array[index])
            {
                let callURI = deck.apiPrefix + encodeURIComponent(array[index].replaceAll("///", "//").replaceAll("/", "\\/")) + deck.apiSuffix;
                console.log("Retrieving Data: " + callURI);
                return rp({url: callURI, json: true}).then(body => {
                    body.data.forEach(card => {
                        let cardName = this.CleanCardName(card.name);
                        if (!this.cardList[cardName]
                            || !this.cardList[cardName].updated 
                            || (this.cardList[cardName].updated < expiryTime))
                        {
                            this.cardsAdded = true;
                            this.cardList[cardName] = {};
                            this.cardList[cardName].updated = now;
                            this.cardList[cardName].data = card;
                            this.cardList[cardName].type = card.type_line
                                .replaceAll("///", '—')
                                .replaceAll("//", '—')
                                .replaceAll("Basic", "")
                                .replaceAll(/Legendary/g, "")
                                .replaceAll("Artifact Creature", "Creature")
                                .replaceAll("Enchantment Creature", "Creature")
                                .replaceAll("Enchantment Artifact", "Artifact")
                                .split('—')[0]
                                .trim(' ');
                        }
                    });
                    //console.log(deck.cards);
                    
                    return resolve(this.retrieveData(deck, array, index + 1, msg));
    
                    //console.log(body.data);
                }, () => {
                    console.log('Scryfall call failed for URL: ' + callURI);
                    //Re-do Call.
                    if (count++ < 3)
                    {
                        return resolve(this.retrieveData(deck, array, index, msg, count));
                    }
                });
            }
            else
            {
                let keys = Object.keys(deck.cards);

                for (var key in deck.cards)
                {
                    let cardName = this.CleanCardName(key);
                    let card = this.cardList[cardName];
                    deck.cards[cardName].data = card.data;
                    deck.cards[cardName].type = card.type;
                    deck.colors = deck.colors.concat(card.data.colors);
                }

                deck.cardTypes = _.mapValues(
                    _.groupBy(keys.map(key => deck.cards[key])
                                .filter(card => card.mainboard > 0)
                            , 'type')
                    );

                    //console.log(deck.cards["Find"]);
                    //console.log(deck.cards["Ritual of Soot"]);
                                
                deck.cardTypes["Sideboard"] = keys.map(key => deck.cards[key]).filter(card => card.sideboard > 0);
                deck.colors = deck.colors.filter((v,i,a) => a.indexOf(v) == i);
                deck.textTitle = deck.title;
                deck.title = deck.colors.map(color => `{${color}}`).join("") + deck.title;
                deck.title = this.renderEmojis(deck.title);

                if (this.cardsAdded)
                {
                    this.cardsAdded = false;
                    this.fileMan.saveData("mtgCards", "_cards");
                }

                return resolve(deck);
            }
        });
    }

    generateDashboardEmbed(deck, embed, key, board)
    {
        let cardsText = deck.cardTypes[key]
            .map(card => `[${card.name}](${card.data.scryfall_uri}) x ${card[board]}`).join('\n')
        if (cardsText.length > 1023)
        {
            cardsText = deck.cardTypes[key].map(card => `${card.name} x ${card[board]}`).join('\n')
        }
        embed.addField(`${this.emojis[key]}  ${key} - ${_.sumBy(deck.cardTypes[key], board)}`, 
            cardsText, true);
    }

    generateEmbed(deck, command, msg)
    {
        return new Promise(resolve => {
            let title = ""; // deck.title; // msg.author.username;
            let description;
            if (deck.showImport)
            {
                description = deck.importText;
            }
            let footerText = "Type '!help decklist' for more information on how to use this command.";

    
            let embed = new Discord.RichEmbed({
                title,
                description,
                footer: {text: footerText, 
                    icon_url: "https://cdn.discordapp.com/emojis/413457407239520256.png?v=1"},
                url: deck.url || `http://mtg.kiradien.com?code=${deck.deckCode}&sIds=${deck.sIds}`,
                //color: this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
                //thumbnail: card.image_uris ? {url: card.image_uris.normal} : null, //could use small, however clicking on thumbnail is ideal way to expand.
                //image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
            })
            .setTimestamp();
            
            // embed.author = {
            //     name: deck.title + " - " + deck.author,
            //     //url: `https://kitsu.io/anime/${displayData.attributes.slug}`,
            //     icon_url: "http://streamdecker.kiradien.com/image.php?card=back"
            // }
            if (!!deck.author)
            {
                deck.importAttachment.name = `${deck.textTitle || deck.author}-MTGArena.txt`;
            }
            
            if (deck.showDashboard)
            {
                embed.title = deck.title + " Decklist link - " + deck.author;
                //console.log(grouped);
                for (let key in deck.cardTypes)
                {
                    if (!key || !this.emojis[key])
                    {
                        console.log(`Could not find key: ${key}`);
                        console.log(deck.cardTypes[key]);
                        let cardObj = deck.cardTypes[key][0];
                        console.log(deck.cards[this.CleanCardName(cardObj.name)]);
                    }
                    else
                    {
                        if (deck.cardTypes[key] && deck.cardTypes[key].length > 0)
                        {
                            if (key == "Sideboard")
                            {
                                this.generateDashboardEmbed(deck, embed, key, "sideboard");
                            }
                            else
                            {
                                this.generateDashboardEmbed(deck, embed, key, "mainboard");
                            }
                        }
                    }
                }
            }
            else
            {
                let card = deck.displayCards[0];
                embed.title = card.data.printed_name || card.name;

                if (card.mana_cost) {
                    embed.title += ' ' + card.mana_cost;
                }
    
                // DFC use card_faces array for each face
                if (card.layout === 'transform' && card.card_faces) {
                    if (card.card_faces[0].mana_cost) {
                        embed.title += ' ' + card.card_faces[0].mana_cost;
                    }
                    card.image_uris = card.card_faces[0].image_uris;
                }
                embed.description = this.generateDescriptionText(card.data);
                
                embed.title = _.truncate(this.renderEmojis(embed.title), {length: 256, separator: '<'});
                embed.description = this.renderEmojis(embed.description);

                embed.url = card.data.scryfall_uri;
                embed.color = this.getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card);
                embed.image = card.data.image_uris ? {url: card.data.image_uris.normal} : null;
            }


            resolve(embed);
        });
    }

    fetchLastFromUser(command, channel, user, fetchQuery, count, limit, callingMsg)
    {
        if (count++ < limit)
        {
            channel.fetchMessages(fetchQuery).then(messages => 
            {
                let message = messages.filter(msg => (!user || msg.author.id === user.id)
                    && msg.content.match(this.matchesAnyRegex)
                ).first();
                
                if (message)
                {
                    return this.handleMessage(command, message.content, message, callingMsg);
                }
                else
                {
                    let lastMsg = messages.last();
                    if (!lastMsg)
                    {
                        limit = count;
                    }
                    else
                    {
                        fetchQuery.before = lastMsg.id;
                    }
                    return this.fetchLastFromUser(command, channel, user, fetchQuery, count, limit, callingMsg);
                }
            });

        }
        else
        {
            return channel.send(`No decklists found for the specified user in the last ${100 * limit} messages in this channel.`);
        }
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



    CleanCardName(name)
    {
        return name.split('/')[0].trim();;
    }

    //up to Base76 - 75 safe?
    convertBase(value, from_base, to_base) {
        //console.log(value);
        value = value.toString();
        var range = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*_=()[]!.,`'".split('');
        var from_range = range.slice(0, from_base);
        var to_range = range.slice(0, to_base);
        
        var dec_value = value.split('').reverse().reduce(function (carry, digit, index) {
          if (from_range.indexOf(digit) === -1) throw new Error('Invalid digit `'+digit+'` for base '+from_base+'.');
          return carry += from_range.indexOf(digit) * (Math.pow(from_base, index));
        }, 0);
        
        var new_value = '';
        while (dec_value > 0) {
          new_value = to_range[dec_value % to_base] + new_value;
          dec_value = (dec_value - (dec_value % to_base)) / to_base;
        }
        return new_value || '0';
    }

    chunkArray(array, size) {
        const chunked_arr = [];
        for (let i = 0; i < array.length; i++) {
          const last = chunked_arr[chunked_arr.length - 1];
          if (!last || last.length === size) {
            chunked_arr.push([array[i]]);
          } else {
            last.push(array[i]);
          }
        }
        return chunked_arr;
    }
}
module.exports = magicdeck;


// /^(Legion Lieutenant|Swamp)$/
// %2F%5E%28Legion+Lieutenant%7CSwamp%29%24%2F
//https://api.scryfall.com/cards/search?q=name:/^((Legion%20Lieutenant)|(Swamp))$/
//pretty=true&