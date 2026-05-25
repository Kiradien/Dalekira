const _ = require('lodash');
const Discord = require('discord.js');
const rp = require("request-promise-native");
const tough = require('tough-cookie');
const cheerio = require('cheerio');
const logger = require("log4js").getLogger('webnovel_epub');
const https = require('https');
const http = require('http');
const request = require('request');
const fs = require('fs');
const path = require("path");
//const cloudscraper = require('cloudscraper');
const mUtils = require("./zModuleUtilities");

const url = require('url');
//const { options } = require('superagent');

class webnovel_epub {
    constructor(modules, fileMan) {
        this.name = "webnovel_epub";
        this.commands = {
            wn_get: {
                aliases: [],
                inline: false,
                multiline: false,
                description: null, //"Get Chapters",
                help: null
            },
            wn_generate: {
                aliases: [],
                inline: false,
                multiline: false,
                description: null, // "Generate Epub from Chapters",
                help: null
            }
        };
        this.modules = modules;
        this.fileMan = fileMan;
        //this.cardList = this.fileMan.getData("mtgCards", "_cards", {}, "json");
        //this.fileMan.saveData("mtgCards", "_cards", "json");
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        if (command == "wn_get")
        {
            var regexResult = /(\d+)(?:(?: ([0-9]+$)|(?: ([a-z0-9\-]+)(?: (\d+))?)))?/ig.exec(parameter);
            this.wn_get(msg, regexResult[1], regexResult[2] || regexResult[4], regexResult[3])
        }
        else if (command == "wn_generate")
        {
            let options = {};
            return msg.channel.send("test", options);
        }
    }

    wn_get(msg, bookId, volumeId, token){
        //https://www.webnovel.com/go/pcm/chapter/getContent?_csrfToken=kMTD9Vp0bPaJ92sd0w5RCVK0KhXeGkY5sjRffGK2&bookId=14064812306272705&chapterId=51465030109027207&_=1612005978338
        let BookInfo = {
            msg: msg,
            bookId: regexResult[1]
        }, me = this;
    
        me.GetInitialCookies(token).then(async initResponse => {
            BookInfo.token = initResponse.token;
            BookInfo.cookies = initResponse.cookie;
    
            var BookInformationRequest = me.GetBookInformation(BookInfo);
            var ChapterRequest = me.GetChapterList(BookInfo);
    
            
    
            ////
    
            var chapters = [];
            if (BookInfo.CoverImage) {
                let CoverChapter = {
                    //title: "Message to reader",
                    //author: "NULL",
                    data: `<img src="${BookInfo.CoverImage}" \/>`,
                    excludeFromToc: false,
                    beforeToc: true,
                    verbose: false
                };
                chapters.push(CoverChapter);
            }
            else {
                BookInfo.CoverImage = "http://mtg.kiradien.com/transparent.png";
            }
    
            //////////
            await BookInformationRequest;
            await ChapterRequest;
            //Save BookInfo to file.
    
    
            let SynopsisChapter = {
                title: "Synopsis",
                data: BookInfo.SynopsisText,
                excludeFromToc: false,
                beforeToc: true,
                verbose: false
            };
            chapters.push(SynopsisChapter);
        });
    }

    GetOptions(BookInfo)
    {
        return {
            headers: {
                cookie: BookInfo.cookies
            }
        };
    }
    
    async GetInitialCookies(token)
    {
        var returnObj = {}, me = this;
        return new Promise((resolve, reject) => {
            let opt = {
                headers: {}
            };
    
            if (!!token)
            {
                opt.headers["cookie"] = `_csrfToken=${token}; `;
            }
            else
            {
                opt.headers["cookie"] = ``;
            }
            mUtils.getWebResponse("https://m.webnovel.com/", 0, "Main URL", opt, me.GetProgress).then(response => {
                let csrfHeader = response.headers['set-cookie'].filter(item => item.indexOf('_csrfToken=') > -1)[0];
                if (!!csrfHeader)
                {
                    token = csrfHeader.split(/[\=\;]/)[1];
                }
    
                returnObj.cookie = opt.headers["cookie"] + response.headers['set-cookie'].join('; ');
                returnObj.token = token;
                resolve(returnObj);
            });
        });
    }
    
    async GetBookInformation(BookInfo)
    {
        var token = BookInfo.token, bookId = BookInfo.bookId, me = this;
        let opt = me.GetOptions(BookInfo);
        BookInfo.CoverImage = `https://img.webnovel.com/bookcover/${bookId}/600/600.jpg`;
    
        return new Promise((resolve, reject) => {
            //Add logic to look for local configuration.
            me.outputMessage("Requesting webnovel information", BookInfo.sentMsg);
    
            mUtils.getWebResponse(`https://m.webnovel.com/ajax/book/GetBookDetailPage??_csrfToken=${token}&bookId=${bookId}`, 0, "Book Information", opt, me.GetProgress).then(response => {
                let bodyData = JSON.parse(response.body);
                let bookInfo = bodyData.data.bookInfo;
                BookInfo.SeriesName = bookInfo.bookName;
                BookInfo.Title = BookInfo.SeriesName;
                BookInfo.Author = bookInfo.authorName;
                BookInfo.FileName = `${BookInfo.SeriesName}`;
                BookInfo.SynopsisText = bookInfo.description.replaceAll(/(.*)/, "<p>$1<\/p>").replaceAll("<p>$1<\/p>", "<p><\/p>");
                /*        
                    VolumeName: "Volume",
                    VolumeNumber: 1,
                */
                resolve(response);
            });
        });
    }
    
    async GetChapterList(BookInfo)
    {
        var token = BookInfo.token, bookId = BookInfo.bookId, me = this;
        let opt = me.GetOptions(BookInfo);
        BookInfo.Chapters = [];
        BookInfo.Volumes = [];
    
        return new Promise((resolve, reject) => {
            mUtils.getWebResponse(`https://m.webnovel.com/ajax/chapter/getChapterListAjax?_csrfToken=${token}&bookId=${bookId}`, 0, "Chapter List", opt, me.GetProgress).then(response => {
                me.outputMessage("Chapter List Retrieved!", BookInfo.sentMsg);
                let chapter = null;
                let data = JSON.parse(response.body).data;
    
                data.volumeItems.forEach(function (volumeItem, volumeIndex) {
                    BookInfo.Volumes[volumeItem.index] = {
                        id: volumeItem.index,
                        name: volumeItem.name,
                        chapterCount: volumeItem.chapterCount
                    };
                    //Could work on multiple volumes here, but thats a pain.
                    volumeItem.chapterItems.forEach(function (chapterItem, chapterItemIndex) {
                        //confirm isAuth matches logged in account
                        if (chapterItem.isAuth === 1) {
                            chapter = {
                                // url: `https://www.webnovel.com/book/${bookId}/${chapterItem.chapterId}?from=catalog`,
                                //url: `https://www.webnovel.com/apiajax/chapter/GetContent?_csrfToken=${token}&bookId=${bookId}&chapterId=${chapterItem.chapterId}`,
                                //url: `https://m.webnovel.com/go/pcm/chapter/getContent?_csrfToken=${token}&bookId=${bookId}&chapterId=${chapterItem.chapterId}`,
                                volume: volumeItem.index,
                                index: chapterItem.index,
                                chapterId: chapterItem.chapterId,
                                text: chapterItem.chapterName,
                                obj: chapterItem
                            };
                            BookInfo.Chapters.push(chapter);
                        }
                        //skip non auth chapters.
                    });
                });
    
                resolve(BookInfo);
            });
        });
    }



    outputMessage(text, msg, options, immediate, textDebug) {
        logger.log(text);
    }

    GetProgress()
    {
        return "FakeProgress";
    }
    

    handleTestcase()
    {
        //Code to generate simple epub
        //code to upload simple epub
    }
}
module.exports = webnovel_epub;
