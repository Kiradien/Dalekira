const _ = require('lodash');
const Discord = require('discord.js');
const log = require("log4js").getLogger('admin users');

class users {
    constructor(modules, client) {
        this.name = "users";
        this.modules = modules;
        this.client = client;
    }

    handleMessage(parameter, msg) {
        if (parameter)
        {
            
            let users = this.client.users.filter(user => user.username.toLowerCase().startsWith(parameter.toLowerCase()));

            if (!!users)
            {
                return msg.channel.send(users.map(user => user.toString()).join('\n'));
            }
        }

        return msg.channel.send("Please enter a User Name");
    }
}
module.exports = users;
//129697888811876352