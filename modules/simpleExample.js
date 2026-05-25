const _ = require('lodash');
const Discord = require('discord.js');

class simpleExample {
    constructor(modules) {
        this.name = "simpleExample";
        this.commands = {
            test: {
                aliases: [],
                inline: false,
                multiline: false,
                description: "Simple example command",
                help: 'Just call the command to see what it does',
                examples: ["!test"]
            }
        };
        //this.location = 'https://github.com/bra1n/judgebot';
        this.modules = modules;
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        if (command == "test")
        {
            let test = new Date(1,);
            let msgText = 'Hey, Listen!';
            let options = {};
            //options = { files: [{ attachment: Buffer.from("TESTING"), name: "test.txt" }] };
            //console.log(msg.author.id === '113803878322929664');
            return msg.channel.send(msgText, options);
        }
    }

    handleTestcase()
    {
        //Code to generate simple epub
        //code to upload simple epub
    }
}
module.exports = simpleExample;
