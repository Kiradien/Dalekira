const rp = require("request-promise-native");
const cloudscraper = require('./pkgMod/cloudscraper-master/index');

async const getWebResponse = (callUri, attempt, textName, options, GetProgress) => {
    let me = this;
    return new Promise((resolve, reject) => {
        textName = textName || "";
        attempt = (attempt || 0) + 1;
        options = options || {};
        options.method = options.method || 'GET';
        options.uri = callUri;
        options.headers = options.headers || {};
        //options.jar = this.cookieJar;
        //options.simple = false;

        options.headers['User-Agent'] = options.headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36';
        options.resolveWithFullResponse = true;
        rp(options)
        .then(async response => {
            var sentMsg = null;
            
            let body = response.body;
            if (response.statusCode == 403) {
                if (attempt <= 5) {
                    outputMessage(`403 encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                    await new Promise(resolve2 => setTimeout(resolve2, 30000));
                    resolve(await me.getResponse(callUri, attempt, textName));
                }
                else {
                    reject(response);
                }
            }
            else if (response.statusCode == 404) {
                //Could get from Wayback here; not sure whether worth it.
                outputMessage(`404 encountered. Cancelling generation of object. ${textName}`)
                reject(response);
            }
            else if (response.statusCode == 502) {
                if (attempt <= 10) {
                    outputMessage(`502 - Bad Gateway encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                    await new Promise(resolve2 => setTimeout(resolve2, 30000));
                    resolve(await me.getResponse(callUri, attempt, textName));
                }
                else {
                    reject(response);
                }
            }
            else if (body.indexOf("http-equiv='refresh'") + body.indexOf('http-equiv="refresh"') > 0
                && attempt < 10) {
                link = $("meta[http-equiv='refresh']")
                    .attr("content")
                    .split(';')[1]
                    .replace("url=", "");

                outputMessage(`Meta Refresh Detected: ${link}`, sentMsg);
                resolve(await me.getResponse(link, attempt, textName));
            }
            else {
                let progress = '';
                if (!!GetProgress) progress = GetProgress();
                outputMessage(`${progress} Retrieved Data: ${textName}`, sentMsg);
                resolve(response);
            }
        }, async response => { //error handling
            if (response.statusCode == 403) {
                if (attempt <= 5) {
                    outputMessage(`403 encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                    await new Promise(resolve2 => setTimeout(resolve2, 30000));
                    resolve(await me.getResponse(callUri, attempt, textName));
                }
                else {
                    reject(response);
                }
            }
            else if (response.statusCode == 404) {
                //Could get from Wayback here; not sure whether worth it.
                outputMessage(`404 encountered. Cancelling generation of object. ${textName}`)
                reject(response);
            }
            else if (response.statusCode == 502) {
                if (attempt <= 10) {
                    outputMessage(`502 - Bad Gateway encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                    await new Promise(resolve2 => setTimeout(resolve2, 30000));
                    resolve(await me.getResponse(callUri, attempt, textName));
                }
                else {
                    reject(response);
                }
            }
            else if (response.statusCode == 503)
            {
                cloudscraper.get(options).then((response) => 
                {
                    if (response.statusCode == 200)
                    {
                        resolve(response);
                    }
                    else
                    {
                        reject(response);
                    }
                }, reject);

            }
            else
            {
                reject(response);
            }
        })
        .catch(exception => {
            reject(exception);
        });
    });
}

const outputMessage = (text, msg, options, immediate, textDebug) => {
    if (!!msg && !!text) {
        if (!immediate) {
            this.OutputMessageDelay(text, msg, options, 2500);
        }
        else {
            if (!!this.DelayedMessages[msg.id]) {
                this.DelayedMessages[msg.id].running = false;
            }
            if (msg.editable) {
                msg.edit(text, options);
            }
            else {
                msg.channel.send(text, options);
            }
        }
    }
    else {
        if (!!text)
        {
            console.log(`Output: ${text}`);
        }
        if (!!textDebug) {
            console.log("[DEBUG]: " + textDebug);
        }
    }
}

//Global
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

module.exports = {
    getWebResponse,
    outputMessage
}