const log4js = require("log4js");
const request = require("request");
const chalk = require("chalk");
const fs = require('fs');

class fileMan {
    constructor() {
        this.name = "fileMan";
        //this.location = 'https://github.com/bra1n/judgebot';
        this._settings = [];
    }

    addData(type, name, data)
    {
        if (!type || !name || !data)
        {
            return;
        }
        this.getData(type, name).push(data);
        this.saveData(type, name);
    }

    getData(type, name, defaultValue, extension)
    {
        extension = extension || "json";
        if (!this._settings[type])
        {
            this._settings[type] = [];
        }

        if (!this._settings[type][name])
        {
            this._settings[type][name] = defaultValue || [];
            var settingsPath = `./Settings/${type}/${name}.${extension}`;
            if (fs.existsSync(settingsPath))
            {
                var data = fs.readFileSync(settingsPath, 'utf8');
                this._settings[type][name] = JSON.parse(data);
            }
        }

        return this._settings[type][name];

    }
    
    saveData(type, name, extension)
    {
        extension = extension || "json";
        if (!type || !name)
        {
            return;
        }
        let data = this.getData(type, name);
        //console.log(data);
        let settingsPath = `./Settings/${type}/${name}.${extension}`;
        fs.writeFile(settingsPath, JSON.stringify(data), 
            function(err) {
                if (err) {
                    return console.log(err);
                }
            }
        );
    }

}

module.exports = fileMan;