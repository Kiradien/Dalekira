const Epub = require("./pkgMod/EPub/EPub");
const rp = require("request-promise-native");
const tough = require('tough-cookie');
const cheerio = require('cheerio');
const logger = require("log4js").getLogger('EPUB Generator');
const https = require('https');
const http = require('http');
const request = require('request');
const fs = require('fs');
const path = require("path");
//const cloudscraper = require('cloudscraper');
const cloudscraper = require('./pkgMod/cloudscraper-master/index');

const url = require('url');

class epub {
    constructor(modules, fileMan) {
        this.epubChapter = new (require('./epubChapter'))(this);
        this.name = "epub";
        this.settingsModule = modules[0];
        this.commands = {
            epub: {
                aliases: [],
                inline: false,
                description: "Generate an EPub from a coded source (e.g. novelupdates)",
                help: 'Generate an epub file from a volume link',
                examples: [`!${this.name} https://www.novelupdates.com/series/chrome-shelled-regios/`,
                `!${this.name} http://domain.site $(".content a:contains('Chapter')") reverse`,
                `!${this.name} http://domain.site $(".content a") false`
                ]
            }
        };
        this.modules = modules;

        this.PreToC = {
            title: "Message to reader",
            //author: "NULL",
            data: "This Epub was generated from web data and is not meant to be sold.<br \/><br \/>If this work is officially licensed, please support it's authors.",
            excludeFromToc: false,
            beforeToc: true,
            verbose: false
        };

        this.DelayedMessages = {};
        this.Debugging = false;

//TO ADD
/*
https://boxnovel.net/restarting-life-in-another-world.novel
https://www.novelhall.com/Restarting-Life-In-Another-World-13171/
*/

        this.GenerationRules = [
            new HostDefinition(this, /(http[s\:\/]+.+?) (?:\$\(['"`](.*)['"`]\)) (true|false|1|0|yes|no)/i, this.handleMessageGeneric, null),
            //new HostDefinition(this, /(http.+NovelUpdates\.com\/series\/[\%0-9a-z\/\-]+)/i, this.handleMessageNovelUpdates, null),
            new HostDefinition(this, /(http.+NovelUpdates\.com\/series\/[\%0-9a-z\/\-]+) false/i, this.handleMessageSpecialHandling,
                {
                    qName: null, qTitle: ".seriestitlenu", qAuthor: "#authtag", qImage: ".seriesimg img, .serieseditimg img", qSynopsis: "#editdescription, #description", qChapters: "a[href*='/extnu/']", qChapterReverseOrder: true,
                    optionMethod: "POST", optionUri: "https://www.novelupdates.com/wp-admin/admin-ajax.php",
                    optionHeaders: {}, optionBody: {}, optionForm: {
                        "action": "nd_getchapters", "mygrr": 0, "mypostid": null
                    }, optionsFieldName: "mypostid", optionsFieldQuery: "#mypostid", uniqueLink: false,
                    handleMethod: this.handleChapterForwarding
                }),
            new HostDefinition(this, /(http.+NovelUpdates\.com\/series\/[\%0-9a-z\/\-]+)/i, this.handleMessageSpecialHandling,
                {
                    qName: null, qTitle: ".seriestitlenu", qAuthor: "#authtag", qImage: ".seriesimg img, .serieseditimg img", qSynopsis: "#editdescription, #description", qChapters: "a[href*='/extnu/']", qChapterReverseOrder: true,
                    optionMethod: "POST", optionUri: "https://www.novelupdates.com/wp-admin/admin-ajax.php",
                    optionHeaders: {}, optionBody: {}, optionForm: {
                        "action": "nd_getchapters", "mygrr": 0, "mypostid": null
                    }, optionsFieldName: "mypostid", optionsFieldQuery: "#mypostid", uniqueLink: true,
                    handleMethod: this.handleChapterForwarding
                }),
                

            //https://foxaholic.com/wp-content/plugins/madara-core/assets/js/script.js?ver=1.6.3
            // new HostDefinition(this, /(http.+foxaholic\.com\/novel\/.+)/i, this.handleMessageSpecialHandling,
            // {
            //     qName: null, qTitle: ".breadcrumb a[href*='novel']", qAuthor: ".author-content", qImage: ".summary_image img", qSynopsis: ".summary__content", qChapters: "li.wp-manga-chapter a", qChapterReverseOrder: true,
            //     optionMethod: "POST", optionUri: "https://foxaholic.com/wp-admin/admin-ajax.php",
            //     optionHeaders: { "origin": "https://foxaholic.com" }, optionBody: {}, optionForm: {
            //         "action": "manga_get_chapters", "manga": null
            //     }, optionsFieldName: "manga", optionsFieldQuery: ".rating-post-id", uniqueLink: false,
            //     handleMethod: this.handleMessageGeneric
            // }),

            new HostDefinition(this, /(http.+scribblehub\.com\/[0-9a-z\/\-]+)/i, this.handleMessageSpecialHandling,
                {
                    qName: null, qTitle: ".fic_title", qAuthor: ".auth_name_fic", qImage: ".novel-cover img", qSynopsis: ".wi_fic_desc", qChapters: "a[href*='scribblehub.com/read']", qChapterReverseOrder: true,
                    optionMethod: "POST", optionUri: "https://www.scribblehub.com/wp-admin/admin-ajax.php",
                    optionHeaders: {}, optionBody: {}, optionForm: {
                        "action": "wi_gettocchp", "strmypostid": 0, "strSID": null, "strFic": "yes"
                    }, optionsFieldName: "strSID", optionsFieldQuery: "#mypostid"
                }),

            new HostDefinition(this, /(http.+listnovel\.com\/[0-9a-z\/\-]+)/i, this.handleMessageSpecialHandling,
                {
                    qName: null, qTitle: ".post-content .summary-content .rate-title", qAuthor: ".author-content", qImage: ".summary_image img", qSynopsis: ".summary__content", qChapters: "li.wp-manga-chapter a[href*='listnovel.com/novel/']", qChapterReverseOrder: true,
                    optionMethod: "POST", optionUri: "https://listnovel.com/wp-admin/admin-ajax.php",
                    optionHeaders: {}, optionBody: {}, optionForm: {
                        "action": "manga_get_chapters", "manga": null
                    }, optionsFieldName: "manga", optionsFieldQuery: ".summary_content .post-rating .rating-post-id"
                }),
            new HostDefinition(this, /(http.+creativenovels\.com\/novel\/[0-9a-z\/\-]+)/i, this.handleMessageSpecialHandling, {
                qName: null, qTitle: null, qAuthor: "a[href*='creativenovels.com/member/']", qImage: "img.book_cover", qSynopsis: ".novel_page_synopsis", qChapters: null, qChapterReverseOrder: true,

                optionMethod: "POST", optionUri: "https://creativenovels.com/wp-admin/admin-ajax.php",
                optionHeaders: {}, optionBody: {}, optionForm: {
                    "action": "crn_chapter_list", "view_id": null, "s": null
                }, optionsFieldName: ["view_id", "s"],
                optionsFieldQuery: [function (BookInfo) {
                    let postId = BookInfo.$("link[rel='shortlink']").attr("href").split('=');
                    return (postId[postId.length - 1])
                }, function (BookInfo) {
                    let securityCode = /\{.*\}/.exec(BookInfo.$("script:contains('chapter_list_summon'):contains('security')").html())[0];
                    securityCode = JSON.parse(securityCode);
                    //optionUri = securityCode.ajaxurl;
                    return (securityCode.security);
                }],
                specialChapterLogic: function (body) {
                    return body.split(".define.")[1].split(".end_data.")
                        .map(function (linkSegment) {
                            let retval = linkSegment.split('.data.');
                            if (retval[3] === "available") {
                                return ({
                                    url: retval[0],
                                    text: retval[1],
                                    obj: retval
                                });
                            }
                            return null;
                        }).filter(linkSegment => !!linkSegment);
                }
            }),
            new HostDefinition(this, /(http.+novelfull\.com\/.+)/i, this.handleMessageGeneric, {
                qName: null, qTitle: ".books .title", qAuthor: "a[href*='/author/']", qImage: ".books img", qSynopsis: ".desc-text", qChapters: ".list-chapter a", qChapterReverseOrder: false,
                linksMultipage: ".next a"
            }),
            new HostDefinition(this, /(http.+lightnovelworld\.com\/.+)/i, this.handleMessageGeneric, {
                qName: null, qTitle: ".novel-info .novel-title", qAuthor: ".novel-info a[href*='/author/'] span", qImage: "meta[property='og:image'], meta[itemprop='image']", qSynopsis: ".summary .content", qChapters: ".chapter-list li a", qChapterReverseOrder: false,
                linksMultipage: "li.PagedList-skipToNext a", customTimeout:3000
            }),
            new HostDefinition(this, /(http.+lightnovel\.world\/.+)/i, this.handleMessageGeneric, {
                qName: null, qTitle: ".book_info_r h1", qAuthor: ".book_info_r h1 span", qImage: ".book_info_l img", qSynopsis: ".book_info_desc", qChapters: ".chapter_content li a", qChapterReverseOrder: false,
                customTimeout:3000
            }),
            new HostDefinition(this, /(http.+re\-library\.com\/.+)/i, this.handleMessageGeneric, {
                qName: null, qTitle: null, qAuthor: null, qImage: "meta[property='og:image'], meta[itemprop='image']", qSynopsis: null, qChapters: ".su-subpages a", qChapterReverseOrder: false,
                customTimeout:3000
            }),
            new HostDefinition(this, /(http.+light-novel\.online\/.+)\??/i, this.handleMessageGeneric, {
                qName: null, qTitle: "h1.series-name", qAuthor: ".series-owner_name", qImage: "meta[property^='og:image']", qSynopsis: ".summary-content", qChapters: ".list-chapters a", qChapterReverseOrder: true,
                linksMultipage: "ul.pagingnation li a:contains('>')", //Not sure on this, may happen twice.
                replaceMultipageUrl: function(url) {
                    if (url.indexOf('/s/') != -1)
                    {
                        return url;
                    }
                    var lastSlash = url.lastIndexOf('/');
                    return `${url.slice(0, lastSlash)}/s/${url.slice(lastSlash+1)}`; 
                }
            }),

            new HostDefinition(this, /(http.+royalroad\.com\/fiction\/[0-9a-z\/\-]+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".fic-title h1", qAuthor: ".fic-title h4 span[property='name']", qImage: ".fic-header img", qSynopsis: ".hidden-content", qChapters: "#chapters tr a", qChapterReverseOrder: null }),
            new HostDefinition(this, /(http.+machineslicedbread\.xyz\/[a-z\/\-]+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: "#primary article .entry-title", qAuthor: null, qImage: "#primary article img", qSynopsis: null, qChapters: "#primary article a[href*='machineslicedbread.xyz/']", qChapterReverseOrder: null }),

            //Using completely custom method for webnovel.
            new HostDefinition(this, /(http.+webnovel\.com\/book\/((?:.*_)?([0-9]+)))(?:$|\/)/i, this.handleMessageWebNovelCom, 
                { customTimeout:1500 }),

            new HostDefinition(this, /http.+(mywuxiaworld\.com\/book\/(\w+))/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".pt-bookdetail-info h1 a", qAuthor: ".pt-bookdetail-info a[href*='author/']", qImage: null, qSynopsis: ".pt-bookdetail-info .pt-bookdetail-intro", qChapters: ".pt-chapter-content .full a:not(.fulltip)", qChapterReverseOrder: false,
                    replaceUrl: function(data) { return `https://${data[1]}`; } }),

            // new HostDefinition(this, /http.+\.(wuxiaworld\.co\/.+)/i, this.handleMessageGeneric,
            //     { qName: null, qTitle: "#maininfo #info h1", qAuthor: "#maininfo #info p:contains('Author')", qImage: "#fmimg img", qSynopsis: "#maininfo #intro", qChapters: ".box_con #list dl a", qChapterReverseOrder: false,
            //         replaceUrl: function(data) { return `https://www.${data[1]}`; } }),

            new HostDefinition(this, /http.+\.(wuxiaworld\.co\/.+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".book-name", qAuthor: ".author .name", qImage: ".book-img img", qSynopsis: ".about-wrapper .content", qChapters: "a.chapter-item", qChapterReverseOrder: false
                    , replaceUrl: function(data) { return `https://www.${data[1]}`; } }),
            new HostDefinition(this, /http.+\.(novelupdates\.cc\/.+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".book-name", qAuthor: ".author .name", qImage: ".book-img img", qSynopsis: ".about-wrapper .content", qChapters: "a.chapter-item", qChapterReverseOrder: false
                    , replaceUrl: function(data) { return `https://www.${data[1]}`; } }),
            new HostDefinition(this, /http.+(readlightnovel\.cc\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".book-name", qAuthor: ".author .name", qImage: ".book-img img", qSynopsis: ".about-wrapper .content", qChapters: "a.chapter-item", qChapterReverseOrder: false
                    , replaceUrl: function(data) { return `https://www.${data[1]}`; } }),
            new HostDefinition(this, /http.+(readlightnovel\.co\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".book-name", qAuthor: ".author .name", qImage: ".book-img img", qSynopsis: ".about-wrapper .content", qChapters: "a.chapter-item", qChapterReverseOrder: false
                    , replaceUrl: function(data) { return `https://www.${data[1]}`; } }),
//".pt-content .pt-bookdetail img.pt-bookdetail-img"
            new HostDefinition(this, /(http.+wuxiaworld\.online\/.+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".entry-header .entry-title", qAuthor: ".entry-header a[href*='/author/']", qImage: null, qSynopsis: "#noidungm", qChapters: ".list_chapter .chapter-list a", qChapterReverseOrder: true }),

            new HostDefinition(this, /(http.+novelonlinefull\.com\/.+)/i, this.handleMessageGeneric,
                { qName: null, qTitle: ".truyen_info .truyen_info_right h1", qAuthor: ".truyen_info .truyen_info_right a[href*='/search_author/']", qImage: "meta[property^='og:image']", qSynopsis: "#noidungm", qChapters: ".list_chapter .chapter-list a", qChapterReverseOrder: true }),

            new HostDefinition(this, /(http.+kiss-novel\.com\/[\w\-]+)/i, this.handleMessageGeneric, {
                qName: null, qTitle: ".post-title", qAuthor: null, qImage: ".tab-summary .summary_image img", qSynopsis: ".description-summary", qChapters: ".listing-chapters_wrap ul.main a", qChapterReverseOrder: true,
                linksMultipage: ".navigation-ajax a:contains('NEXT')"
            }),

            new HostDefinition(this, /(http.+readlightnovel\.org\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".block-header .block-title", qAuthor: ".novel-left .novel-details .novel-detail-item:contains('Author') .novel-detail-body", qImage: ".novel-cover img", qSynopsis: ".novel-right .novel-details .novel-detail-item:contains('Description') .novel-detail-body", qChapters: ".tab-content a", qChapterReverseOrder: false }),

            new HostDefinition(this, /(http.+novelhall\.com\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".book-info h1", qAuthor: ".total.booktag span:contains('Author')", qImage: null, qSynopsis: ".intro", qChapters: "#morelist.book-catalog li.post-11 a", qChapterReverseOrder: false }),


            new HostDefinition(this, /(http.+wattpad\.com\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: "#story-landing header h1", qAuthor: "#story-landing header .author-info a.send-author-event", qImage: "#story-landing header .cover img", qSynopsis: "#story-landing .description", qChapters: "#story-tabs .table-of-contents a", qChapterReverseOrder: false }),

            new HostDefinition(this, /(http.+fastnovel\.net\/.+) false/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".left-content h1.name", qAuthor: ".left-content .meta-data a[href*='/author/']", qImage: "meta[property^='og:image']", qSynopsis: ".block-film:contains('Synopsis') .film-content", qChapters: ".book li a", qChapterReverseOrder: false }),
            
            new HostDefinition(this, /(http.+readonlinenovels\.com\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".title h3 b", qAuthor: ".title h3 span", qImage: -1, qSynopsis: null, qChapters: ".table-content a", qChapterReverseOrder: false }),

            new HostDefinition(this, /(http.+fastnovel\.net\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".left-content h1.name", qAuthor: ".left-content .meta-data a[href*='/author/']", qImage: "meta[property^='og:image']", qSynopsis: ".block-film:contains('Synopsis') .film-content", qChapters: ".book li a", qChapterReverseOrder: false,
                customTimeout:10000, chapterFilter: function(linkObjs)
                    {
                        let unique = {};
                        
                        return linkObjs.filter((v, i) => {
                            if (!unique[v.text])
                            {
                                unique[v.text] = true;
                                return true;
                            }
                            return false;
                        });
                    } 
                }),

            new HostDefinition(this, /(http.+centinni\.com\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".post-title", qAuthor: ".author-content", qImage: "meta[property^='og:image']", qSynopsis: ".summary__content", qChapters: ".page-content-listing .main.version-chap .wp-manga-chapter a", qChapterReverseOrder: true }),
            new HostDefinition(this, /(http.+wuxiaworld\.site\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".post-title", qAuthor: ".author-content", qImage: "meta[property='og:image']", qSynopsis: ".summary__content", qChapters: ".page-content-listing .main.version-chap .wp-manga-chapter a", qChapterReverseOrder: true }),
            new HostDefinition(this, /(http.+wuxia\.today\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: "header h2", qAuthor: null, qImage: -1, qSynopsis: "article.excerpt p.note", qChapters: "div.t a", qChapterReverseOrder: false }),
            new HostDefinition(this, /(http.+daonovel\.com\/.+)/i, this.handleMessageGeneric, 
                { qName: null, qTitle: ".post-title", qAuthor: ".author-content", qImage: "meta[property='og:image']", qSynopsis: ".summary__content", qChapters: ".page-content-listing .main.version-chap .wp-manga-chapter a", qChapterReverseOrder: true }),

            new HostDefinition(this, /(http.+baka-tsuki.+title\=(([a-z_,!]+?):(.+?)[_]?([0-9\.]+)))/i, this.NotImplemented, null),
        ];
    }

    getCommands() {
        return this.commands;
    }

    handleMessage(command, parameter, msg) {
        return msg.channel.send("Generating E-Book. . . Please Wait...").then(sentMsg => {
            let BookInfo = {};
            parameter = msg.content;

            BookInfo.msg = msg;
            BookInfo.sentMsg = sentMsg;
            BookInfo.tempDir = `EBook/tmp/${msg.id}`;
            //BookInfo.TakeChapters = 1;

            this.handleMsg(parameter, BookInfo);
        });
    }

    //method separated for testing.
    async handleMsg(parameter, bookInfo) {
        let me = this;
        return new Promise(async (resolve, reject) => {
            bookInfo.parameter = parameter;
            let BookInfo = new BookInfoObj(me, bookInfo);
            BookInfo.verbose = false;

            this.GenerationRules.forEach((item, index) => {
                if (!BookInfo.GenerationRule) {
                    BookInfo.RegExResult = item.Regex.exec(BookInfo.parameter);
                    if (!!BookInfo.RegExResult) {
                        BookInfo.GenerationRule = item;
                    }
                }
            });

            if (!!BookInfo.GenerationRule) {
                BookInfo.SeriesUrl = BookInfo.RegExResult[1];

                resolve(await BookInfo.GenerationRule.method(BookInfo));

            }
            else {
                this.outputMessage('Incorrect format for domain. Non Specialized Domains can be called with additional parameters. Type `!help epub` for instructions on how to use this command!',
                    BookInfo.sentMsg, null, true);
            }
        });
    }
    async NotImplemented(BookInfo) {
        return new Promise(resolve => {
            let me = BookInfo.this;
            //BookInfo.GenerationRule.AdditionalParameters
            me.outputMessage(`This call is not yet implemented, examinatory processing under way. ${BookInfo.GenerationRule.Regex}`,
                BookInfo.sentMsg, null, true);
            resolve();
        });
    }
    async handleMessageGeneric(BookInfo) {
        let me = this.this;
        let bookParams = BookInfo.GenerationRule.AdditionalParameters || {};
        let qName = bookParams.qName;
        let qTitle = bookParams.qTitle;
        let qAuthor = bookParams.qAuthor;
        let qImage = bookParams.qImage;
        let qSynopsis = bookParams.qSynopsis;
        let qChapters = bookParams.qChapters || BookInfo.RegExResult[2];
        let qChapterReverseOrder = bookParams.qChapterReverseOrder || BookInfo.RegExResult[3];
        let ReverseOrder = qChapterReverseOrder == "true" || qChapterReverseOrder == "1";
        bookParams.handleMethod = bookParams.handleMethod || me.handleChapter;


        me.outputMessage("Handling Generically", BookInfo.sentMsg);
        //let hostname = "http://" + me.ExtractHostname(BookInfo.SeriesUrl);

        if (!!bookParams.replaceUrl)
        {
            BookInfo.SeriesUrl = bookParams.replaceUrl(BookInfo.RegExResult);
        }
        else
        {
            BookInfo.SeriesUrl = BookInfo.SeriesUrl.split("?")[0];
        }
        let $ = await BookInfo.getBookInfo(qName, qTitle, qAuthor, qImage, qSynopsis, qChapters, ReverseOrder);
        BookInfo.$ = $;

        await me.handleChapters(BookInfo, bookParams.handleMethod);
    }

    async handleMessageSpecialHandling(BookInfo) {
        let me = this.this;
        let bookParams = BookInfo.GenerationRule.AdditionalParameters;
        let qName = bookParams.qName;
        let qTitle = bookParams.qTitle;
        let qAuthor = bookParams.qAuthor;
        let qImage = bookParams.qImage;
        let qSynopsis = bookParams.qSynopsis;
        let qChapters = bookParams.qChapters || BookInfo.RegExResult[2];
        let qChapterReverseOrder = bookParams.qChapterReverseOrder || BookInfo.RegExResult[3];
        let ReverseOrder = qChapterReverseOrder == "true" || qChapterReverseOrder == "1";
        bookParams.handleMethod = bookParams.handleMethod || me.handleChapter;
        me.outputMessage("Recognized site structure, retrieving information.", BookInfo.sentMsg);

        let $ = await BookInfo.getBookInfo(qName, qTitle, qAuthor, qImage, qSynopsis, null, null);
        //$ may be exception, but ignoring for now.
        BookInfo.$ = $;

        if (!!bookParams.optionsFieldQuery && !!bookParams.optionsFieldName) {
            if (Array.isArray(bookParams.optionsFieldName)) {
                bookParams.optionsFieldName.forEach(function (item, index) {
                    if (!!bookParams.optionsFieldQuery[index].call) {
                        bookParams.optionForm[bookParams.optionsFieldName[index]] = bookParams.optionsFieldQuery[index](BookInfo);
                    }
                    else {
                        bookParams.optionForm[bookParams.optionsFieldName[index]] = $(bookParams.optionsFieldQuery[index]).val();
                    }
                });
            }
            else {
                if (!!bookParams.optionsFieldQuery.call) {
                    bookParams.optionForm[bookParams.optionsFieldName] = bookParams.optionsFieldQuery(BookInfo);
                }
                else {
                    bookParams.optionForm[bookParams.optionsFieldName] = $(bookParams.optionsFieldQuery).val();
                }
            }
        }

        let options = {
            method: bookParams.optionMethod,
            uri: bookParams.optionUri,
            headers: bookParams.optionHeaders,
            body: bookParams.optionBody,
            form: bookParams.optionForm
        };

        //TODO:::: 1190
        me.getChaptersSpecial(BookInfo, options, qChapters, ReverseOrder)
            .then(async result => {
                await me.handleChapters(BookInfo, bookParams.handleMethod)
            });
    }

    //Oh shit. The tears when a generic method won't cut it. :'(
    async handleMessageWebNovelCom(BookInfo) {
        let me = this.this;
        me.outputMessage("Recognized webnovel . com", BookInfo.sentMsg);
        let hostname = "http://" + me.ExtractHostname(BookInfo.parameter);
        let bookId = BookInfo.RegExResult[3];
        //BookInfo.SeriesUrl = `https://m.webnovel.com/book/${bookId}`;
        BookInfo.SeriesUrl = `https://m.webnovel.com/`;

        var options = {
            url: BookInfo.SeriesUrl,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36' },
            //resolveWithFullResponse: true
        }

        me.outputMessage("Retrieving webnovel token", BookInfo.sentMsg);
        request.get(options, async function (err, res, body) {
            if (!!err)
            {
                throw err;
            }
            let csrfHeader = res.headers['set-cookie'].filter(item => item.indexOf('_csrfToken=') > -1)[0];

            if (!!csrfHeader) {
                let token = csrfHeader.split(/[\=\;]/)[1];
                options.url = `https://m.webnovel.com/ajax/book/GetBookDetailPage??_csrfToken=${token}&bookId=${bookId}`;
                me.outputMessage("Requesting webnovel information", BookInfo.sentMsg);

                let InfoRequest = new Promise(function (resolve, reject) {
                    request.get(options, async function (err, res, body) {
                        let bodyData = JSON.parse(body);
                        let bookInfo = bodyData.data.bookInfo;
                        BookInfo.SeriesName = bookInfo.bookName;
                        BookInfo.Title = BookInfo.SeriesName;
                        BookInfo.Author = bookInfo.authorName;
                        BookInfo.FileName = `${BookInfo.SeriesName}`;
                        BookInfo.SynopsisText = bookInfo.description;
                        resolve(body);
                    }
                    );
                });

                options.url = `https://m.webnovel.com/ajax/chapter/getChapterListAjax?_csrfToken=${token}&bookId=${bookId}`;
                request.get(options, async function (err, res, body) {
                    me.outputMessage("Chapter List Retrieved!", BookInfo.sentMsg);
                    let chapter = null;
                    let data = JSON.parse(body).data;
                    data.volumeItems.forEach(function (volumeItem, index) {
                        //Could work on multiple volumes here, but thats a pain.
                        volumeItem.chapterItems.forEach(function (chapterItem, chapterItemIndex) {
                            if (chapterItem.isAuth === 1) {
                                //chapterName
                                chapter = {
                                    url: `https://m.webnovel.com/book/${bookId}/${chapterItem.chapterId}?from=detail`,
                                    //url: `https://www.webnovel.com/apiajax/chapter/GetContent?_csrfToken=${token}&bookId=${bookId}&chapterId=${chapterItem.chapterId}`,
                                    //url: `https://m.webnovel.com/go/pcm/chapter/getContent?_csrfToken=${token}&bookId=${bookId}&chapterId=${chapterItem.chapterId}`,
                                    text: chapterItem.chapterName,
                                    obj: chapterItem
                                };
                                BookInfo.ChapterUrls.push(chapter);
                            }
                            //skip non auth chapters.
                        });
                    }
                    );

                    if (!!BookInfo.TakeChapters || !!BookInfo.SkipChapters) {
                        BookInfo.ChapterUrls = BookInfo.ChapterUrls//.toArray()
                            .splice(BookInfo.SkipChapters || 0, BookInfo.TakeChapters || BookInfo.ChapterUrls.length - (BookInfo.SkipChapters || 0));
                    }
                    else {
                        //links = links.toArray();
                    }
                    BookInfo.CoverImage = `https://img.webnovel.com/bookcover/${bookId}/600/600.jpg`;


                    if (BookInfo.CoverImage) {
                        let CoverChapter = {
                            //title: "Message to reader",
                            //author: "NULL",
                            data: `<img src="${BookInfo.CoverImage}" \/>`,
                            excludeFromToc: false,
                            beforeToc: true,
                            verbose: false
                        };
                        BookInfo.Chapters.push(CoverChapter);
                    }
                    else {
                        BookInfo.CoverImage = "http://mtg.kiradien.com/transparent.png";
                    }
                    BookInfo.Chapters.push(BookInfo.PreToC);

                    await InfoRequest;

                    let SynopsisChapter = {
                        title: "Synopsis",
                        data: BookInfo.SynopsisText.replaceAll(/(.*)/, "<p>$1<\/p>").replaceAll("<p>$1<\/p>", "<p><\/p>"),
                        excludeFromToc: false,
                        beforeToc: true,
                        verbose: false
                    };
                    BookInfo.Chapters.push(SynopsisChapter);

                    me.outputMessage("Generating Chapters. . .", BookInfo.sentMsg);

                    //me.GenerateChapters(BookInfo.ChapterUrls.slice(0), BookInfo);
                    await me.handleChapters(BookInfo, me.handleChapter);
                }
                );
            }
        });

    }


    async handleChapters(BookInfo, method) {
        let callUri = BookInfo.ChapterUrls.shift();
        let me = this;

        while (callUri != null) {
            let chapter = await method(BookInfo, callUri);
            if (!!chapter) {
                BookInfo.Chapters.push(chapter);
                BookInfo.CompletedChapterUrls.push(callUri);
            }

            callUri = BookInfo.ChapterUrls.shift();
            await new Promise(resolve => setTimeout(resolve, BookInfo.customTimeout || 1000));
        }
        me.GenerateEBook(BookInfo);
    }

    async handleChapter(BookInfo, LinkObj, body) {
        let me = BookInfo.this;
        return new Promise(async (resolve, reject) => {
            BookInfo.ChapterUriCycle.forEach((item, index) => {
                BookInfo.ChapterUriRequested.push(item);
            });
            BookInfo.ChapterUriCycle = [];
            BookInfo.ChapterRepeatCount = 0;

            try {
                if (!body) {
                    await me.getChapter(BookInfo, LinkObj)
                    .then(async ChapterData => {
                        body = ChapterData.body;
                        let ChapterObj = await me.epubChapter.GenerateChapter(BookInfo, body, null, LinkObj);
    
                        resolve(ChapterObj);
                    }).catch(ex => {
                        ex.url = ex.aUrl || LinkObj.url;
                        ex.aText = ex.aText || LinkObj.text;
                        console.log(`An Exception occured retrieving ${ex.aText} [${ex.url}]`);
                        console.log(ex);
                        resolve(null);
                    });
                    
                }
                else
                {
                    let ChapterObj = await me.epubChapter.GenerateChapter(BookInfo, body, null, LinkObj);

                    resolve(ChapterObj);
                }
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    async handleChapterForwarding(BookInfo, LinkObj) //handleChapterNovelUpdates(callUris, BookInfo, refreshCount = 0)
    {
        let me = BookInfo.this;
        return new Promise(async (resolve, reject) => {
            let chapter;
            try {
                me.outputMessage(`Attempting to get chapter with forwarding links: ${LinkObj.text}`);
                chapter = await me.getChapter(BookInfo, LinkObj);
            }
            catch (ex) {
                me.outputMessage(`Failed in retrieving chapter [${LinkObj.text}]: (${me.GetSimpleUrlDesc(LinkObj.url)}), skipping.`, BookInfo.sentMsg, null, null, LinkObj.url);
                logger.error(`[handleChapterForwarding] Failed to generate from ${LinkObj.url}`);
            }
            //Check to make sure chapter generation didn't fail.
            if (!!chapter) {
                let body = chapter.body;
                let uri = chapter.request.href;
                let uriLinkObj = BookInfo.CreateLinkObject(uri, LinkObj);
                //Get $chapter from epubChapter logic before looking for links.
                if (BookInfo.ChapterUriRequested.indexOf(uri) < 0 && BookInfo.ChapterUriCycle.indexOf(uri) > 0) {
                    me.outputMessage(`Repeat URL in Cycle: ${me.GetSimpleUrlDesc(uri)}, Generating`, BookInfo.sentMsg, null, null, uri);

                    resolve(await me.handleChapter(BookInfo, uriLinkObj, body));
                }
                else if (BookInfo.ChapterUriRequested.indexOf(uri) > 0) {
                    me.outputMessage(`Repeat URL: ${me.GetSimpleUrlDesc(uri)}, skipping`, BookInfo.sentMsg, null, null, uri);
                    
                    resolve(await me.handleChapter(BookInfo, uriLinkObj, body));
                }
                else if (BookInfo.ChapterRepeatCount >= BookInfo.ChapterRepeatLimit) {
                    me.outputMessage(`Reached chapter reload limit. Generating against last uri: ${me.GetSimpleUrlDesc(uri)}`, BookInfo.sentMsg, null, null, uri);

                    BookInfo.ChapterUriCycle.push(LinkObj.url);
                    BookInfo.ChapterUriCycle.push(uriLinkObj.url);
                    resolve(await me.handleChapter(BookInfo, uriLinkObj, body));
                }
                else {
                    BookInfo.ChapterRepeatCount++;
                    BookInfo.ChapterUriCycle.push(LinkObj.url);
                    BookInfo.ChapterUriCycle.push(uriLinkObj.url);
                    //Actually look for next link.
                    let genChapter = await me.epubChapter.GenerateChapter(BookInfo, body, null, uriLinkObj);
                    let $ = cheerio.load(genChapter.data);

                    let chapters = [];
                    let seekRedirect = $.text().length < 3000;
                    if (seekRedirect) {
                        chapters = $(`a[href*='${chapter.request.host}']`);
                        chapters = chapters.filter((index, item) => {
                            let itemText = $.html(item).toLowerCase();
                            let itemInnerText = $(item).text().toLowerCase();
                            let href = item.attribs["href"].split("?")[0].toLowerCase();
                            let isImage = href.endsWith(".jpg") || href.endsWith(".jpeg") || href.endsWith(".png")
                                || href.endsWith(".gif") || href.endsWith(".webp") || href.endsWith(".tiff") || href.endsWith(".tif")
                                || href.endsWith(".psd") || href.endsWith(".raw") || href.endsWith(".arw") || href.endsWith(".cr2")
                                || href.endsWith(".nrw") || href.endsWith(".k25") || href.endsWith(".bmp") || href.endsWith(".dib")
                                || href.endsWith(".heif") || href.endsWith(".heic") || href.endsWith(".ind") || href.endsWith(".indd")
                                || href.endsWith(".indt") || href.endsWith(".jp2") || href.endsWith(".j2k") || href.endsWith(".jpf")
                                || href.endsWith(".jpx") || href.endsWith(".jpm") || href.endsWith(".mj2") || href.endsWith(".svg")
                                || href.endsWith(".svgz") || href.endsWith(".pdf");

                            return ( !isImage &&
                                (itemText.indexOf("chapter") >= 0
                                    || (itemText.indexOf("continu") >= 0 && itemText.indexOf("read") >= 0)
                                    || $(item).find("img[src*='Click-me']").length > 0
                                    //|| itemInnerText.indexOf("read") == 0 || itemInnerText.indexOf("here") == 0
                                )
                                && BookInfo.ChapterUriCycle.indexOf(item.href) == -1
                                && BookInfo.ChapterUriRequested.indexOf(item.href) == -1);
                        });
                    }

                    let innertext = $.text();
                    if (chapters.length == 0 && innertext.length < 1500) {
                        let matchingUris = $(`a[href*="${me.ExtractHostname(uri)}"]`);
                        if (matchingUris.length == 0 && innertext.length < 1000)
                        {
                            matchingUris = $("a:contains('Chapter'), a:contains('chapter'), a:contains('Here'), a:contains('here'), a:contains('HERE'), a[href*='Chapter'], a[href*='chapter'], a img[src*='Click-me']");
                        }
                        matchingUris = matchingUris.filter((index, item) => {
                            let href = item.attribs["href"].split("?")[0].toLowerCase();
                            let isImage = href.endsWith(".jpg") || href.endsWith(".jpeg") || href.endsWith(".png")
                                || href.endsWith(".gif") || href.endsWith(".webp") || href.endsWith(".tiff") || href.endsWith(".tif")
                                || href.endsWith(".psd") || href.endsWith(".raw") || href.endsWith(".arw") || href.endsWith(".cr2")
                                || href.endsWith(".nrw") || href.endsWith(".k25") || href.endsWith(".bmp") || href.endsWith(".dib")
                                || href.endsWith(".heif") || href.endsWith(".heic") || href.endsWith(".ind") || href.endsWith(".indd")
                                || href.endsWith(".indt") || href.endsWith(".jp2") || href.endsWith(".j2k") || href.endsWith(".jpf")
                                || href.endsWith(".jpx") || href.endsWith(".jpm") || href.endsWith(".mj2") || href.endsWith(".svg")
                                || href.endsWith(".svgz") || href.endsWith(".pdf");

                            return (!isImage && BookInfo.ChapterUriCycle.indexOf(href) == -1
                                && BookInfo.ChapterUriRequested.indexOf(href) == -1);
                        });

                        chapters = matchingUris.filter((index, item) => {
                            let itemText = $(item).text().toLowerCase();
                            return itemText.indexOf("here") >= 0;
                        });
                        
                        if (chapters.length == 0 && matchingUris.length > 0 && innertext.length < 500)
                        {
                            //When in doubt, just take all matching URIs
                            chapters = matchingUris;
                        }

                        if (chapters.length > 5) {
                            chapters = [];//chapters.splice(5);
                            //if over 5, unreliable.
                        }
                    }

                    if (chapters.length > 0) {
                        if (chapters.get) {
                            chapters = chapters.get();
                        }
                        chapters.forEach((item, index) => {
                            item = BookInfo.CreateLinkObject($(item));
                            me.outputMessage(` Redirection chapter detected ${me.GetSimpleUrlDesc(item.url)}. Adding to queue: [${item.text}]`, BookInfo.sentMsg, null, null, item.url);
                        });
                        chapters.reverse().forEach((item, index) => {
                            BookInfo.ChapterUrls.unshift(BookInfo.CreateLinkObject($(item)));
                        });
                        resolve(null);
                    }
                    else {
                        BookInfo.ChapterRepeatCount = 0;
                        BookInfo.ChapterUriCycle.forEach((item, index) => {
                            BookInfo.ChapterUriRequested.push(item);
                        });
                        BookInfo.ChapterUriCycle = [];
                        resolve(genChapter);
                    }

                }
            }
            else
            {
                resolve(null);
            }
        });
    }

    async getChapter(BookInfo, LinkObj, attempt) {
        let retval = await BookInfo.getPage(encodeURI(LinkObj.url), attempt, LinkObj.text);
        return retval;
    }









    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////

    async getChaptersSpecial(BookInfo, RequestOptions, qChapter, qChapterReverseOrder) {
        let me = this;
        return new Promise((resolve, reject) => {
            BookInfo.getPage(RequestOptions.uri, null, "Chapter Retrieval", RequestOptions)
            .then(response => {
                let body = response.body;
                let chapters = [];
                if (!!BookInfo.GenerationRule.AdditionalParameters.specialChapterLogic) {
                    chapters = BookInfo.GenerationRule.AdditionalParameters.specialChapterLogic(body);
                }
                else {
                    let $ = cheerio.load(body);
                    //resolve($);

                    //Look for and ignore duplicates
                    if (!BookInfo.GenerationRule.AdditionalParameters.uniqueLink) {
                        chapters = $(qChapter).get()
                            .map(item => BookInfo.CreateLinkObject($(item)));
                        if (chapters.get)
                            chapters = chapters.get();
                        if (!!qChapterReverseOrder) {
                            chapters = chapters.reverse();
                        }
                    }
                    else {
                        let orderArray = [];
                        let items = $(qChapter).get();
                        if (!!qChapterReverseOrder) {
                            items = items.reverse();
                        }

                        items.forEach((item, index) => {
                            //Attempt to eliminate duplication while using the LATEST version of chapter.
                            let indexName = (((item.firstChild.attribs || item.attribs || [])["title"]) || item.text()).trim();
                            chapters[indexName] = BookInfo.CreateLinkObject($(item));
                            if (orderArray.indexOf(indexName) == -1) {
                                orderArray.push(indexName);
                            }
                        }
                        );

                        chapters = orderArray.map(item => chapters[item]);
                    }
                }

                if (!!BookInfo.TakeChapters || !!BookInfo.SkipChapters) {
                    chapters = chapters.splice(BookInfo.SkipChapters || 0, BookInfo.TakeChapters || chapters.length - (BookInfo.SkipChapters || 0));
                }
                me.outputMessage("Chapter List Retrieved.", BookInfo.sentMsg);
                BookInfo.ChapterUrls = chapters;
                resolve(chapters);
            }).catch(ex => {
                me.outputMessage("Exception encountered retrieving Chapters.");
                reject(ex);
                console.log(ex.message);
                console.log(ex.stack);
            });
        });
    }

    //////////////////////Area below here hasn't changed much
    findCoverImage(BookInfo, links, hostname, $, directLink) {
        let imageLinkSearch = links;
        let coverImage;

        if (!!$) {
            //First look for meta property="og:image"
            let metaImage = $('meta[property="og:image"]');
            if (!!metaImage) {
                let imgSrc = metaImage.attr("content");

                if (!imgSrc) {
                    imgSrc = $("img").attr("src");
                }

                if (imgSrc.indexOf("/") < 2) {
                    imgSrc = hostname + imgSrc;
                }

                if (directLink) {
                    BookInfo.CoverImage = imgSrc;
                }
                else {
                    let fileName = `${BookInfo.tempDir}/${path.basename(imgSrc).split("?")[0]}`;
                    if (!fs.existsSync(BookInfo.tempDir)) {
                        fs.mkdirSync(BookInfo.tempDir);
                    }

                    let file = fs.createWriteStream(fileName);

                    let protocol = http;

                    if (imgSrc.indexOf("https") == 0) {
                        protocol = https;
                    }

                    let request = protocol.get(imgSrc, function (response) {
                        response.pipe(file);
                    });

                    BookInfo.CoverImage = fileName;
                }
            }
        }

        if (!BookInfo.CoverImage) {
            while ((!coverImage || !coverImage[0] || !coverImage[0].attribs) && !!imageLinkSearch && imageLinkSearch.length > 0) {
                //console.log(imageLinkSearch);
                coverImage = imageLinkSearch.find("img");
                if (imageLinkSearch.prev().length > 0) {
                    imageLinkSearch = imageLinkSearch.prev();
                }
                else {
                    imageLinkSearch = imageLinkSearch.parent();
                }
            }

            if (!!coverImage && !!coverImage[0] && !!coverImage[0].attribs) {
                //Get largest size image available via this URL
                let imgSrc = coverImage[0].attribs.src;
                if (imgSrc.indexOf("/") < 2) {
                    imgSrc = hostname + imgSrc;
                }

                let fileName = `${BookInfo.tempDir}/${path.basename(imgSrc).split("?")[0]}`;

                if (!fs.existsSync(BookInfo.tempDir)) {
                    fs.mkdirSync(BookInfo.tempDir);
                }

                let file = fs.createWriteStream(fileName);

                let protocol = http;

                if (hostname.indexOf("https") == 0) {
                    protocol = https;
                }

                let request = protocol.get(imgSrc, function (response) {
                    response.pipe(file);
                });

                BookInfo.CoverImage = fileName;
                if (this.Debugging) {
                    this.outputMessage(fileName, BookInfo.msg);
                    // BookInfo.msg.channel.send(fileName);
                }
            }
            else {
                //BookInfo.CoverImage = null;
                this.outputMessage("No Title Image Found!", BookInfo.sentMsg);
                logger.error("No Title Image Found!");
            }
        }
    }

    findFirstCoverImageOrDefault(BookInfo, hostname, content, $) {
        let coverImage;

        if (!!content) {
            coverImage = content.find("img")[0].attribs.src;
            if (!!coverImage) {
                BookInfo.CoverImage = coverImage;
            }
        }

        if (!BookInfo.CoverImage && !!$) {
            let links = [];
            return this.findCoverImage(BookInfo, links, hostname, $);
        }
    }

    GenerateEBook(BookInfo) {
        this.outputMessage("Beginning Generation of EPub File...", BookInfo.sentMsg, null, true);

        var option = {
            title: BookInfo.Title,
            author: BookInfo.Author,
            //publisher: "Macmillan & Co.",
            cover: BookInfo.CoverImage,
            content: BookInfo.Chapters,
            verbose: BookInfo.verbose
        };

        let outputDir = "EBook/output";
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        BookInfo.FileName = BookInfo.FileName.replaceAll(/[^\w\s()-]/gi, '');

        let fileName = `${BookInfo.FileName}.epub`;
        let filePath = `${outputDir}/${fileName}`;

        try {
            let file = new Epub(option, filePath);

            let me = this;
            this.outputMessage(`EPub File generation started... [${fileName.split(".")[0]}]`, BookInfo.sentMsg);

            file.promise.then(file => {
                if (!!BookInfo.msg && !!BookInfo.sentMsg) {
                    me.outputMessage("Preparing to upload generated EPub...", BookInfo.sentMsg);

                    let formData = {
                        "passcode": process.env.dalekira_token,
                        "bot_upload": fs.createReadStream(filePath)
                    };

                    let retval = {};
                    this.outputMessage("Uploading generated EPub...", BookInfo.sentMsg);

                    request.post({
                        url: 'http://dalekira.kiradien.com/up.php',
                        formData: formData
                    }, function optionalCallback(err, httpResponse, body) {
                        me.outputMessage("EPub uploaded, attempting to generate link...", BookInfo.sentMsg);
                        retval.success = true;
                        retval.data = body;
                        if (err) {
                            retval.success = false;
                            retval.data = err;
                        }

                        if (retval.success) {
                            let msgText = `File uploaded to external site for 24 hours: ${retval.data}`;
                            console.log(msgText);
                            me.outputMessage(msgText, BookInfo.sentMsg, null, true);
                        }
                        else {
                            let msgText = "Failed to attach generated e-book. Maybe too big?";
                            me.outputMessage(msgText, BookInfo.sentMsg, null, true);

                            logger.error(err);
                        }
                    });
                    //Bot can only upload up to 8MB. Should probably put in "If" condition, maybe upload to a different location if it happens

                    //   BookInfo.msg.channel.send("EBook Generated!", {
                    //       files: [ {attachment: filePath, name: fileName} ]
                    //   }).then(sentMsg => {
                    //       BookInfo.sentMsg.delete();
                    //       rimraf(BookInfo.tempDir, function () { 
                    //           //Files Removed
                    //       });
                    //   }).catch(err => {

                    //       let formData = {
                    //           "passcode": process.env.dalekira_token,
                    //           //"my_buffer": Buffer.from([1, 2, 3]),
                    //           "bot_upload": fs.createReadStream(filePath)
                    //       };

                    //       let retval = {};

                    //       request.post({
                    //           url:'http://dalekira.kiradien.com/up.php', 
                    //           formData: formData
                    //           }, function optionalCallback(err, httpResponse, body) {
                    //           retval.success = true;
                    //           retval.data = body;
                    //           if (err) {
                    //               retval.success = false;
                    //               retval.data = err;
                    //           }
                    //           // console.log(httpResponse);

                    //           if (retval.success)
                    //           {
                    //               BookInfo.sentMsg.edit(`File could not be attached to Discord, uploaded to external site for 24 hours instead: ${retval.data}`);
                    //           }
                    //           else
                    //           {
                    //               BookInfo.sentMsg.edit("Failed to attach generated e-book. Maybe too big?");

                    //               logger.error(err);
                    //           }
                    //       });
                    //       //Bot can only upload up to 8MB. Should probably put in "If" condition, maybe upload to a different location if it happens
                    //   });
                }
                else {
                    this.outputMessage("EBook Generated!", BookInfo.msg);
                }
            }, ex => {
                logger.error(ex);
                this.outputMessage("An error occurred generating the EPub!", BookInfo.msg);
            });
        }
        catch (ex) {
            if (!!BookInfo.msg && !!BookInfo.sentMsg) {
                BookInfo.sentMsg.edit("Epub generation failed.");
            }
            logger.error(`An Error occured with epub generation. ${filePath}`);
            logger.error(ex.message);
            logger.error(ex.stack);
        }
    }


    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////

    //Antispam... Don't want bot spamming too much!
    OutputMessageDelay(text, msg, options, delayedTime) {
        if (!!this.DelayedMessages[msg.id]) {
            try {
                this.DelayedMessages.running = true;
                this.DelayedMessages.text = text;
                this.DelayedMessages.options = options;
            }
            catch (err) {
                //Gonna ignore this error too.
            }
        }
        else {
            //console.log(this.DelayedMessages);
            this.DelayedMessages[msg.id] = {
                running: true,
                target: msg,
                text: text,
                options: options
            };

            var delayedMessage = this.DelayedMessages[msg.id];
            var delayedMessages = this.DelayedMessages;
            var msgId = msg.id;


            new Promise(async resolve => {
                setTimeout(function () {
                    if (delayedMessage.running) {
                        //console.log(delayedMessage);
                        if (msg.editable) {
                            msg.edit(delayedMessage.text, delayedMessage.options);
                        }
                        else {
                            msg.channel.send(delayedMessage.text, delayedMessage.options);
                        }
                    }
                    delete delayedMessages[msgId];

                }, delayedTime);
            }).catch(err => { logger.error(err); });
        }
    }
    outputMessage(text, msg, options, immediate, textDebug) {
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

            // if (msg.editable)
            // {
            //     msg.edit(text, options);
            // }
            // else
            // {
            //     msg.channel.send(text, options);
            // }
        }
        else {
            if (!!text)
            {
                console.log(`epubOutput: ${text}`);
            }
            if (!!textDebug) {
                console.log("[DEBUG]: " + textDebug);
            }
            //logger.info(text);
        }
    }

    ExtractHostname(uri) {
        let URL = url.parse(uri);

        if (this.Debugging) {
            return uri;
        }

        return `${URL.host}`;
    }
    ChangeParam(key, sourceURL, newVal) {
        var rtn = sourceURL.split("?")[0],
            param,
            params_arr = [],
            queryString = (sourceURL.indexOf("?") !== -1) ? sourceURL.split("?")[1] : "";
        if (queryString !== "") {
            params_arr = queryString.split("&");
            for (var i = params_arr.length - 1; i >= 0; i -= 1) {
                param = params_arr[i].split("=")[0];
                if (param === key) {
                    //params_arr.splice(i, 1);
                    params_arr[i] = `${key}=${newVal}`;
                }
            }
            rtn = rtn + "?" + params_arr.join("&");
        }
        return rtn;
    }
    GetParam(key, sourceURL) {
        var rtn = sourceURL.split("?")[0],
            param,
            params_arr = [],
            queryString = (sourceURL.indexOf("?") !== -1) ? sourceURL.split("?")[1] : "";
        if (queryString !== "") {
            params_arr = queryString.split("&");
            for (var i = params_arr.length - 1; i >= 0; i -= 1) {
                let params = params_arr[i].split("=");
                if (params[0] === key) {
                    //params_arr.splice(i, 1);
                    return params[1];
                }
            }
            rtn = rtn + "?" + params_arr.join("&");
        }
        return null;
    }
    GetSimpleUrlDesc(uri) {
        let URL = url.parse(uri);

        if (this.Debugging) {
            return uri;
        }

        return `${URL.pathname}`
    }
}
class HostDefinition {
    constructor(caller, regex, method, methodParams) {
        this.this = caller;
        this.Regex = regex;
        this.method = method;
        this.AdditionalParameters = methodParams;
    }
}
class BookInfoObj {
    constructor(caller, bookInfo) {
        let me = this;

        this.this = caller;
        this.RepeatUri = null;
        this.RepeatCount = 0;

        this.msg = bookInfo.msg;
        this.sentMsg = bookInfo.sentMsg;
        this.tempDir = bookInfo.tempDir;
        this.parameter = bookInfo.parameter;
        this.SkipChapters = bookInfo.SkipChapters;
        this.TakeChapters = bookInfo.TakeChapters;

        this.replaceMultipageUrl = function(url)
        {
            return url;
        }

        this.PreToC = {
            title: "Message to reader",
            //author: "NULL",
            data: `<p>This Epub was generated from web pag data and is not meant to be sold.</p>
            <p></p>
            <p>If this work becomes officially licensed, please support it's authors by purchasing it.</p>
            <p></p>
            <p>This was generated from by a chat Bot through the following command:</p>
            <p>${this.parameter}</p>`,
            excludeFromToc: false,
            beforeToc: true,
            verbose: false
        };

        this.VolumeName = bookInfo.VolumeName || "Volume";
        this.VolumeNumber = bookInfo.VolumeNumber || 1;
        this.SeriesUrl = bookInfo.SeriesUrl;
        this.AccessedUris = bookInfo.AccessedUris || [];
        this.Chapters = bookInfo.Chapters || [];
        this.TitleList = bookInfo.TitleList || [];
        this.Titles = bookInfo.Titles || [];
        this.ChapterUrls = bookInfo.ChapterUrls || [];
        //this.GenerationRule = bookInfo.GenerationRule || {};
        //this.GenerationRule.AdditionalParameters = (bookInfo.GenerationRule || {}).AdditionalParameters;
        this.CompletedChapterUrls = [];

        this.ChapterRepeatCount = 0;
        this.ChapterRepeatLimit = 5;
        this.ChapterRepeatAllow = bookInfo.ChapterRepeatAllow || false;
        this.ChapterUriRequested = [];
        this.ChapterUriCycle = [];
        this.cookieJar = rp.jar();

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir);
        }
    }


    GetProgress() {
        let totalUrls = this.CompletedChapterUrls.length + this.ChapterUrls.length
        if (totalUrls == 0)
        {
            return "";
        }
        let CurrentChapter = this.CompletedChapterUrls.length + 1;
        let TotalChapters = CurrentChapter + this.ChapterUrls.length;
        return `[${CurrentChapter} of ${TotalChapters}]`;
    };


    CreateLinkObject(item, prevItem) {
        //linkAttrib = linkAttrib || "href";
        let me = this;
        if (prevItem) {
            let retval = ({
                url: item,
                text: prevItem.text,
                obj: prevItem.obj
            });
            if (item.attr) {
                retval.url = item.attr("href") || item.attr("data-url");
                let chIndex = item.text().toLowerCase().indexOf("chapter");
                if (chIndex >= 0)
                {
                    retval.text = item.text().trim();
                }
                else
                {
                    retval.text = (item.attr("title") || item.text()).trim();
                }
                retval.obj = item
            }
            return retval;
        }
        let uri;
        if (item.attr) {
            uri = item.attr('href') || item.attr("data-url");
        }
        else if (item.attribs) {
            uri = item.attribs['href'] || item.attribs["data-url"];
        }
        let innerItem = item[0] || item;

        let title;
        let chIndex = item.text().toLowerCase().indexOf("chapter");
        if (chIndex >= 0)
        {
            title = item.text();
        }
        else
        {
            do {
                title = innerItem.attribs["title"];
                innerItem = innerItem.firstChild;
            } while (!title && !!innerItem && !!innerItem.firstChild)
        }

        innerItem = item[0] || item;
        if (!!uri) {
            if (!title && !!innerItem && innerItem.tagName && innerItem.tagName.toLowerCase() == "tr") {
                innerItem = item.find("td a").first();
                title = innerItem.text().trim();
            }
            uri = me.fixUrl(uri, item);
            return ({
                url: uri,
                text: (title || item.text()).trim(),
                obj: item
            });
        }
    }

    fixUrl(uri, item) {
        item = item || {};
        if (uri.indexOf("//") == 0) {
            let protocol = "http";
            if (!!item.baseURI) {
                protocol = item.baseURI.split(":")[0];
            }
            uri = `${protocol}:${uri}`;
        }
        else if (uri.indexOf("/") == 0) {
            let protocol = "http";
            if (this.SeriesUrl.indexOf("https") == 0) {
                protocol = "https";
            }
            let hostname = this.this.ExtractHostname(this.SeriesUrl).replace(/\/$/, "");
            uri = protocol + "://" + hostname + uri;
        }
        else if (uri.indexOf("/") == -1) {
            let hostname = this.SeriesUrl.replace(/\w+\.(?:html|php|aspx)(?:\?[\w=,]*)?$/i, "").replace(/\/$/, "") + "/";
            uri = hostname + uri;
        }
        else if (uri.indexOf("/") > 8) {
            let protocol = "http";
            if (this.SeriesUrl.indexOf("https") == 0) {
                protocol = "https";
            }
            let hostname = this.this.ExtractHostname(this.SeriesUrl).replace(/\/$/, "");
            uri = protocol + "://" + hostname + "/" + uri;
        }
        return uri;
    }

    async getChapters($, qMultipage, qChapters) {
        let me = this;
        let nextPage = $(qMultipage);

        if (nextPage.length > 0) {
            let obj = me.CreateLinkObject($(nextPage[0]), null);
            let url = me.replaceMultipageUrl(obj.url);
            return new Promise(resolve => {
                rp({ method: 'GET', url: url })
                    .then(async body => {
                        me.this.outputMessage(`Grabbing chapters from page ${nextPage[0].attribs["href"]}`, me.sentMsg);
                        $ = cheerio.load(body);
                        let links = $(qChapters)
                            .map(function () {
                                return me.CreateLinkObject($(this), null);
                            })
                            .get();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        links = links.concat(await me.getChapters($, qMultipage, qChapters));
                        resolve(links);
                    });
            });
        }
        else {
            return new Promise(resolve => {
                resolve([]);
            });
        }
    }

    

    async getResponse(callUri, attempt, textName, options)
    {
        let me = this;
        return new Promise((resolve, reject) => {
            textName = textName || "";
            attempt = (attempt || 0) + 1;
            options = options || {};
            options.method = options.method || 'GET';
            options.uri = options.uri || callUri;
            options.headers = options.headers || {};
            options.jar = this.cookieJar;
            //options.simple = false;

            options.headers['User-Agent'] = options.headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36';
            options.resolveWithFullResponse = true;
            rp(options)
            .then(async response => {
                let body = response.body;
                if (response.statusCode == 403) {
                    if (attempt <= 5) {
                        me.this.outputMessage(`403 encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                        await new Promise(resolve2 => setTimeout(resolve2, 30000));
                        resolve(await me.getResponse(callUri, attempt, textName));
                    }
                    else {
                        reject(response);
                    }
                }
                else if (response.statusCode == 404) {
                    //Could get from Wayback here; not sure whether worth it.
                    me.this.outputMessage(`404 encountered. Cancelling generation of object. ${textName}`)
                    reject(response);
                }
                else if (response.statusCode == 502) {
                    if (attempt <= 10) {
                        me.this.outputMessage(`502 - Bad Gateway encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
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
    
                    me.this.outputMessage(`Meta Refresh Detected: ${link}`, me.sentMsg);
                    resolve(await me.getResponse(link, attempt, textName));
                }
                else {
                    me.this.outputMessage(`${me.GetProgress()} Retrieved Data: ${textName}`, me.sentMsg);
                    resolve(response);
                }
            }, async response => { //error handling
                if (attempt <= 10 && (response.statusCode == 503 || response.statusCode == 403 && response.message.indexOf("Cloudflare Ray ID:") > 0))
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
                else if (response.statusCode == 403) {
                    if (attempt <= 5) {
                        me.this.outputMessage(`403 encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                        await new Promise(resolve2 => setTimeout(resolve2, 30000));
                        resolve(await me.getResponse(callUri, attempt, textName));
                    }
                    else {
                        reject(response);
                    }
                }
                else if (response.statusCode == 404) {
                    //Could get from Wayback here; not sure whether worth it.
                    me.this.outputMessage(`404 encountered. Cancelling generation of object. ${textName}`)
                    reject(response);
                }
                else if (response.statusCode == 502) {
                    if (attempt <= 10) {
                        me.this.outputMessage(`502 - Bad Gateway encountered; attempting regeneration in 30 seconds. [Attempt ${attempt}]`)
                        await new Promise(resolve2 => setTimeout(resolve2, 30000));
                        resolve(await me.getResponse(callUri, attempt, textName));
                    }
                    else {
                        reject(response);
                    }
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

    async getPage(callUri, attempt, textName, options)
    {
        let me = this;
        return new Promise((resolve, reject) => {
            me.getResponse(callUri, attempt, textName, options)
            .then(response => {
                if (response.headers["content-type"].indexOf("text") == 0){
                    resolve(response);
                }
                else
                {
                    me.this.outputMessage(`${me.GetProgress()} Non-text link detected: ${textName}`);
                    resolve(null);
                }
            })
            .catch(exception => {
                reject(exception);
            });
        });
    }

    async getBookInfo(qName, qTitle, qAuthor, qImage, qSynopsis, qChapters, qChapterReverseOrder) {
        let me = this;

        if (!!me.GenerationRule.AdditionalParameters)
        {
            me.replaceMultipageUrl = me.GenerationRule.AdditionalParameters.replaceMultipageUrl || me.replaceMultipageUrl;
        }

        return new Promise(function (resolve, reject) {
            me.getPage(me.SeriesUrl)
            .then(async response => {
                let body = response.body;
                let $ = cheerio.load(body);
                let imagePromise;

                if (!!me.GenerationRule && !!me.GenerationRule.AdditionalParameters
                    && !!me.GenerationRule.AdditionalParameters.customTimeout)
                {
                    me.customTimeout = me.GenerationRule.AdditionalParameters.customTimeout;
                }

                
                me.this.outputMessage("Retrieving Chapter Links.", me.sentMsg);
                if (!!qChapters) {
                    let links = $(qChapters)
                        .map(function () {
                            return me.CreateLinkObject($(this), null);
                        })
                        .get();

                    if (!!me.GenerationRule && !!me.GenerationRule.AdditionalParameters
                        && !!me.GenerationRule.AdditionalParameters.linksMultipage) {
                        links = links.concat(await me.getChapters($, me.GenerationRule.AdditionalParameters.linksMultipage, qChapters));
                    }

                    if (!!qChapterReverseOrder) {
                        links = links.reverse();
                    }

                    if (!!me.TakeChapters || !!me.SkipChapters) {
                        links = links.splice(me.SkipChapters || 0, me.TakeChapters || links.length - (me.SkipChapters || 0));
                    }
                    else {
                    }

                    if (!!me.GenerationRule.AdditionalParameters && !!me.GenerationRule.AdditionalParameters.chapterFilter)
                    {
                        links = me.GenerationRule.AdditionalParameters.chapterFilter(links);
                    }

                    me.ChapterUrls = links;
                }

                if (!!qName) {
                    me.SeriesName = (me.SeriesName || $(qName).text()).trim();
                    if (!qTitle) {
                        me.Title = me.Title || me.SeriesName;
                    }
                }
                if (!!qTitle) {
                    me.Title = (me.Title || $(qTitle).first().text() || $(qTitle).text()).trim();
                    me.SeriesName = me.SeriesName || me.Title;
                }
                me.FileName = `${me.SeriesName}`;
                if (!!qAuthor) {
                    me.Author = (me.Author || $(qAuthor).text()).trim();
                }

                let titles = $("title").text().split(/[\-\–\|]/);
                if (!me.Title) {
                    me.Title = titles[0].trim();
                }
                if (!me.SeriesName) {
                    me.SeriesName = me.SeriesName || me.Title;
                }
                if (!me.Author) {
                    me.Author = (me.Author || titles[1] || titles[0]).trim();
                }
                me.FileName = `${me.SeriesName}`;
                
                if (qImage == -1)
                {
                    me.CoverImage = "https://www.novelupdates.com/img/noimagefound.jpg";
                }
                else if (!!qImage) {
                    let imgObj = $(qImage);
                    //May want this to point to external method for more complex images.
                    let img = (me.CoverImage || imgObj.attr("src") || imgObj.attr("data-cfsrc") || imgObj.attr("content") || "").trim();

                    if (!!img) {
                        me.CoverImage = me.fixUrl(img, imgObj);
                        me.CoverImage = encodeURI(me.CoverImage);
                        let fileExtension = /[^.]+$/.exec(me.CoverImage)[0];
                        fileExtension = fileExtension.split("?")[0];
                        let fileName = `${me.tempDir}/cover.${fileExtension || 'jpg'}`;
                        me.this.outputMessage("Retrieving Cover Image.", me.sentMsg);
                        if (me.CoverImage.indexOf("/") < 2) {
                            me.CoverImage = "https://" + me.this.ExtractHostname(me.SeriesUrl) + me.CoverImage;
                        }

                        imagePromise = me.getResponse(me.CoverImage, null, "Cover Image", { encoding: null })
                            .then(response => {
                                fs.writeFileSync(fileName, response.body);
                                me.this.outputMessage("Cover Image retrieved.", me.sentMsg);

                                me.CoverImage = path.resolve(fileName);
                                let CoverChapter = {
                                    //title: "Message to reader",
                                    //author: "NULL",
                                    data: `<img src="${me.CoverImage}" />`,
                                    excludeFromToc: false,
                                    beforeToc: true,
                                    verbose: false
                                };
                                me.Chapters.push(CoverChapter);
                                resolve(response);
                            });
                    }
                    else {
                        resolve(img);
                    }

                }
                resolve($);

                await imagePromise;
                if (!me.CoverImage) {
                    me.this.findCoverImage(me, null, me.this.ExtractHostname(me.SeriesUrl), $, true);
                    me.CoverImage = me.CoverImage || "https://www.novelupdates.com/img/noimagefound.jpg";
                    let CoverChapter = {
                        data: `<img src="${me.CoverImage}" />`,
                        excludeFromToc: false,
                        beforeToc: true,
                        verbose: false
                    };
                    me.Chapters.push(CoverChapter);
                }
                me.Chapters.push(me.PreToC);

                if (!!qSynopsis) {
                    me.SynopsisText = $(qSynopsis).html();
                    if (!!imagePromise)
                        me.Chapters.push({
                            title: "Synopsis",
                            data: me.SynopsisText,
                            excludeFromToc: false,
                            beforeToc: true,
                            verbose: false
                        });
                } else {
                    me.this.outputMessage("No Synopsis detected.");
                }
            }).catch(function (ex) {
                me.this.outputMessage("Exception encountered retrieving Book Info.");
                reject(ex);
                console.log(ex.message);
                console.log(ex.stack);
            });
        });
    }
}
module.exports = epub;