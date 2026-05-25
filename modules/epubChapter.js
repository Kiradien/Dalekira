const cheerio = require('cheerio');
const logger = require("log4js").getLogger('EPUB Generator');
const path = require("path");
const sanitizeHtml = require('sanitize-html');
//const imgdl = require('image-downloader');
//const uuidv1 = require('uuid/v1');
//const url = require('url');
const htmlencode = require('htmlencode');

const fs = require('fs');
const https = require('https');
const http = require('http');
const xml2js = require("xml2js");

const pkgAdmZip = require('adm-zip');
const stream = require('stream');

//Currently oneoff
const request = require('request');

class epubChapter {
    constructor(parent) {
        this.Parent = parent;
        this.blogspotEntries = {};
        this.imgDictionary = {};

        this.regexIgnoreGenericDomainsPattern = ".*(?:(premiumsale|drive\.google)\.com).*";
        this.sanitizeAllowedTags = ['h3', 'h4', 'h5', 'h6', 'p', 'a',
            'b', 'i', 'strong', 'em', 'code', 'hr', 'br', 'div', 'blockquote',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe'
            , 'img'];

        //Descriptive Default nulls for HostDefiniton.
        let regex, qContent, qRemoval, qTitle, keepNav, method;
        //new HostDefinition(this, regex, qContent, qRemoval, qTitle, keepNav, method),
        this.GenerationRules = [
            new HostDefinition(this, /null\:\\\\null\.null\.null/i, qContent, qRemoval, qTitle, keepNav, method),
            new HostDefinition(this, /wordexcerpt\.com/i, ".text-left", "div.ap_container, div.ad", "li.active", null, null),
            new HostDefinition(this, /tseirptranslations\.com/i, ".post-inner .post-content", ".csmi", ".post-inner .post-header .post-title", null, null),
            //Title may become a problem on pastebin.
            new HostDefinition(this, /pastebin\.com/i, "#super_frame .text ol", qRemoval, qTitle, keepNav, method),
            new HostDefinition(this, /babelnovel\.com/i, ["blockquote", ".cooked"], qRemoval, "[class*='content-container'] [class*='title'], .title-wrapper", keepNav, method),

            //$("meta[property='og:title']").attr("content") for title, but can't do attr
            new HostDefinition(this, /royalroad\.com/i, ".chapter .chapter-content", ".author-note-portlet", ".fic-header h1", keepNav, method),
            new HostDefinition(this, /(http.+mywuxiaworld\.com\/.+)/i, "div.pt-read-text", qRemoval, ".pt-read-title .size26 a", keepNav, method),
            new HostDefinition(this, /wuxiaworld\.com/i, ".section .panel-default .fr-view", ".chapter-nav", ".section .panel-default h4", keepNav, method),
            new HostDefinition(this, /wuxiaworld\.world/i, ".list_img", qRemoval, ".manga_view_name", keepNav, method),
            new HostDefinition(this, /wuxiaworld\.online\//i, ".content-left #list_chapter .content-area", "h2", qTitle, keepNav, method, { useLinkTitle: true }),
            new HostDefinition(this, /koreanovels\.com/i, qContent, //qRemoval 
                "#comments, #commentsAdd, #postauthor, #custom-meta, header, a:contains('revious'), a:contains('able of '), a:contains('Next')",
                qTitle, keepNav, method),
            new HostDefinition(this, /rinkagetranslation\.com/i, ".entry-content", "[style^='color:#ffffff']", qTitle, keepNav, method),
            new HostDefinition(this, /convallariaslibrary\.com/i, qContent, "div[id*='attachment_']", qTitle, keepNav, method),
            new HostDefinition(this, /rebirthonlineworld\.com/i, qContent, "#post-nav, #comments, .title, #jp-post-flair", ".entry-title", keepNav, method),
            new HostDefinition(this, /sousetsuka\.com/i, qContent, "[style*='#f3f3f3'], [style*='color:white'], .entry-title, .postmeta, .item-control", "h3", keepNav, method),
            new HostDefinition(this, /yamitranslations\.com/i, qContent, ".entry-title, .location, .post-header, .tondemoPrevNext", ".entry-title", keepNav, method),
            new HostDefinition(this, /jigglypuffsdiary\.com/i, qContent, ".entry-meta, .navigation", qTitle, keepNav, method),
            new HostDefinition(this, /deviantart\.com\//i, ".dev-view-deviation .journal-wrapper .gr-body, .legacy-journal", "a.commentslink", qTitle, keepNav, method),
            new HostDefinition(this, /dsrealmtranslations\.com/i, ".wpb_content_element  .wpb_wrapper", qRemoval, qTitle, keepNav, method),
            new HostDefinition(this, /shmtranslations\.com\//i, qContent, "[style*='#ffffff'], [style*='color:white']", qTitle, keepNav, method),
            new HostDefinition(this, /infinitenoveltranslations\.net\//i, qContent, "[style*='#111111']", qTitle, keepNav, method),
            new HostDefinition(this, /catorablog\.wordpress\.com\//i, qContent, "blockquote", qTitle, keepNav, method),
            new HostDefinition(this, /novelsetromans\.eklablog\.com\//i, "div#content .module_contenu_block .article_text", "a:contains('List of Chapters')", qTitle, keepNav, method),
            new HostDefinition(this, /magicalgfthetranslation\.wordpress\.com\//i, ".page-body", qRemoval, qTitle, keepNav, method),
            new HostDefinition(this, /damenano\.com\//i, qContent, ".damen-before-content, .su-button, .adsbyvli, .entry-after-content, .entry-actions", ".entry-content strong", keepNav, method),
            new HostDefinition(this, /fourslimes\.com\//i, qContent, "[style*='font-size:1px']", qTitle, keepNav, method),
            new HostDefinition(this, /re\-library\.com\//i, qContent, "table:contains('Author'):contains('Word Count'), .code-block, .prevPageLink, .nextPageLink, a:contains('⌈ Index ⌋')", qTitle, keepNav, method),
            new HostDefinition(this, /asianhobbyist\.com/i, qContent, "[style^='color:#ffffff'], .osny-nightmode, .code-block", qTitle, keepNav, method),
            new HostDefinition(this, /readlightnovel\.org/i, ".container--content .desc", "p:contains('©'):contains('stolen')", qTitle, keepNav, this.GenerateReadLightNovelOrg),
            new HostDefinition(this, /novelmultiverse\.com/i, qContent, ".seriesmeta, .seriesbox, .snax, .cb_p6_patreon_button, .snax-actions, .adace-after-content", ".entry-header h1", keepNav, method),
            new HostDefinition(this, /yurikatrans\.xyz/i, ".category-yukine-chapter .single_post #content", "#quarts, .adboxarea, .tags", "header h1.title", keepNav, method),
            new HostDefinition(this, /foxaholic\.com\//i, ".entry-content .text-left", qRemoval, ".entry-header.header .breadcrumb .active", keepNav, method),
            //Wattpad needs work - works, but need to get "page2"
            new HostDefinition(this, /wattpad\.com/i, ".part-content .panel-reading", ".comment-marker, .advertisement", ".part-header header h2", keepNav, method),
            new HostDefinition(this, /graverobbertl\.site\//i, qContent, qRemoval, "#main .entry-title:not('.entry-title-small')", keepNav, method),
            //new HostDefinition(this, /foxteller\.com\//i, "#chapter-content", "[class^='neqji'], [class^='laeon'], span:contains('contact@foxteller.com'), span:contains('Several dragons looked at the human girl in amazement.')", ".page-header h3", keepNav, this.GenerateGenericBetweenHR),
            new HostDefinition(this, /zirusmusings\.com/i, "#resizeable-text", qRemoval, "#resizeable-text h2, .elementor-widget-wrap section.elementor-inner-section h1.elementor-heading-title", keepNav, method),
            new HostDefinition(this, /centinni\.com\//i, ".content-area .reading-content div.text-left", qRemoval, ".entry-header.header .wp-manga-nav .breadcrumb .active", keepNav, method),
            new HostDefinition(this, /wuxiaworld\.site\//i, ".content-area .reading-content div.text-left", "a[href='https://wuxiaworld.site']", ".entry-header .wp-manga-nav .breadcrumb .active", keepNav, method),
            new HostDefinition(this, /daonovel\.com\//i, ".content-area .reading-content div.text-left", "a[href='https://wuxiaworld.site']", ".entry-header .wp-manga-nav .breadcrumb .active", keepNav, method),

            new HostDefinition(this, /shintranslations\.com\//i, ".content-area .text-formatting", ".adsbygoogle, #taboola-below-article-thumbnails, div[style*='6pt;']:contains('Advertisement')", ".content-area .main-title", keepNav, method),
            new HostDefinition(this, /yado-inn\.com\//i, qContent, "div.entry-content div.entry-content p:not(:contains('Chapter')), p:contains('yado-inn (dot) com')", "div.entry-content div.entry-content strong", keepNav, method),
            new HostDefinition(this, /novelmultiverse\.com\//i, qContent, qRemoval, qTitle, keepNav, method),
            new HostDefinition(this, /readonlinenovels\.com\//i, ".read-context", qRemoval, ".read-context h2", keepNav, method),
            new HostDefinition(this, /americanfaux\.com\//i, ".post-content", ".post-author, .related-posts", ".post-title", keepNav, method),
            new HostDefinition(this, /sousaku\.blog\//i, qContent, qRemoval, qTitle, keepNav, method, { removeAllAfter: "h2:contains('Cheat'), details", removeAllAfterInclude: true }),
            new HostDefinition(this, /handofvecna\.blogspot\.com\//i, qContent, ".navbar, .pop, .dropt span, div[style*='color: black;'], div[style*='text-align: right;']:contains('handofvecna.blogspot.com')", qTitle, keepNav, method),
            new HostDefinition(this, /lightnovelworld\.com/i, "#chapter-article .chapter-content", "span[style*='font-weight:700;display:block'], .adsbox", "#chapter-article .chapter-header .titles h2", keepNav, method, 
                { removalQuery: "main[role*='main'] style", removalQueryRegex: "\\s*(\\.\\w+)\\s" }),
            new HostDefinition(this, /lightnovel\.world\//i, "#chapter #content_detail", qRemoval, "#content_title", keepNav, method),
            
            //Group together the ones with custom methods
            new HostDefinition(this, /lightnovelstranslations\.com\//i, qContent, "#textbox", qTitle, keepNav, this.GenerateGenericBetweenHR),
            new HostDefinition(this, /shirokuns\.com\//i, qContent, qRemoval, qTitle, keepNav, this.GenerateGenericBetweenHR),
            new HostDefinition(this, /tigertranslations\.org/i, qContent, qRemoval, qTitle, keepNav, this.GenerateTigerTranslation),
            //new HostDefinition(this, /zirusmusings\.com/i, qContent, qRemoval, qTitle, keepNav, this.GenerateZirusMusings),
            new HostDefinition(this, /baka-tsuki\.org/i, qContent, qRemoval, qTitle, keepNav, this.GenerateBakaTsuki),
            new HostDefinition(this, /blogspot\.com/i, qContent, qRemoval, qTitle, keepNav, this.GenerateBlogspotChapter),
            new HostDefinition(this, /novelfull\.com/i, qContent, qRemoval, qTitle, keepNav, this.GenerateNovelFull),
            new HostDefinition(this, /light-novel\.online/i, "#chapter-content", qRemoval, qTitle, keepNav, method, { useLinkTitle: true }),
            new HostDefinition(this, /ebisutranslations\.com/i, ".content-header", qRemoval, ".content-header", keepNav, this.GenerateGenericParentContent),
            new HostDefinition(this, /scribblehub\.com/i, qContent, ".pollend, .pollstart, .wi_news, .modern-footnotes-footnote__note", qTitle, keepNav, method),
            new HostDefinition(this, /stabbingwithasyringe\.home\.blog/i, qContent, "p.has-secondary-color.has-text-color, p.has-background-color.has-text-color", qTitle, keepNav, method),
            new HostDefinition(this, /inoveltranslation\.com/i, ".entry.entry-single", ".wp-block-image, .jp-post-flair, .post-meta-data", qTitle, keepNav, method),
            new HostDefinition(this, /listnovel\.com\/novel\//i, ".reading-content .cha-content", qRemoval, "ol.breadcrumb .active", keepNav, method),
            new HostDefinition(this, /http.+wuxia\.today/i, "div.content .wp.cl", ".money, .article-social", "header.article-header h1.article-title", keepNav, method),

            //Add replace logic for rssbook
            //new HostDefinition(this, /webnovel\.com\/rssbook\/([0-9]+)\/([0-9]+)/i, qContent, qRemoval, qTitle, keepNav, this.GenerateNovelFull),
            new HostDefinition(this, /m\.webnovel\.com\/book\//i, "div[id^='content']",
                ".j_bottom_comment_area, .g_ad_ph, noscript, pirate, .m-thou, .user-links-wrap, p:contains('discord.gg'), p:contains('paypal.me'), p:contains('*.com/'), p:contains('bit.ly'), p:contains('support'):contains('follow the'):contains('link'):contains('Paypal')",
                "h2[class^='ChapterTitle_']", keepNav, this.GenerateNovelFull),

            new HostDefinition(this, /webnovel\.com\/book\//i, qContent,
                ".j_bottom_comment_area, .g_ad_ph, noscript, pirate, .m-thou, .user-links-wrap, p:contains('discord.gg'), p:contains('paypal.me'), p:contains('*.com/'), p:contains('bit.ly'), p:contains('support'):contains('follow the'):contains('link'):contains('Paypal')",
                ".cha-tit", keepNav, this.GenerateNovelFull),
            new HostDefinition(this,  /webnovel\.com\/apiajax\/chapter\//i, qContent, qRemoval, qTitle, keepNav, this.GenerateWebNovel, { rawText: true }),

            //Custom methods using additonal params
            new HostDefinition(this, /rebirth\.online/i, qContent, ".entry-header, .entry-footer", "article.chapter .chapter-title", keepNav, this.GenerateGenericRemoveHidden, {
                qHidden: "p:contains('content-stealing website'), p:contains('chapter was originally posted on'), p:contains('rebirth.online/novel')",
            }),
            new HostDefinition(this, /creativenovels\.com/i, qContent, ".entry-title, .author_bio_post, .announcements_crn", ".entry-title", keepNav, this.GenerateGenericRemoveParent, {
                qElement: "a[href*='twitter.com/CreativeJFB']",
            }),
            new HostDefinition(this, /lightnovelbastion\.com\//i, ".text-left", ".lnbad-tag, blockquote", ".active", keepNav, this.GenerateGenericRemoveParent, {
                qElement: ".zeno_font_resizer_add",
            }),

            new HostDefinition(this, /wuxiaworld\.co/i, ".chapter-entity", qRemoval, ".chapter-title", keepNav, method, {  
                formatContent: function(body) {
                    var retval = body.replace(/\\"/g, '"');
                    retval = retval.replace(/find(?:\s+)authorized(?:\s+)novels(?:\s+)in(?:\s+)webnovel(?:，|,\s+)faster(?:\s+)updates(?:，|,\s+)better(?:\s+)experience(?:，|,\s+)please(?:\s+)click(?:\s+)www\.webnovel\.com(?:\s+)for(?:\s+)visiting\.?/gi, "");
    
                    return retval;
                }
            } ),
            new HostDefinition(this, /novelupdates\.cc/i, ".chapter-entity", qRemoval, qTitle, keepNav, method, { useLinkTitle: true, 
                formatContent: function(body) {
                    var retval = body.replace(/\\"/g, '"');
                    retval = retval.replace(/find(?:\s+)authorized(?:\s+)novels(?:\s+)in(?:\s+)webnovel(?:，|,\s+)faster(?:\s+)updates(?:，|,\s+)better(?:\s+)experience(?:，|,\s+)please(?:\s+)click(?:\s+)www\.webnovel\.com(?:\s+)for(?:\s+)visiting\.?/gi, "");

                    return retval;
                }
            } ),
            new HostDefinition(this, /readlightnovel\.cc/i, ".chapter-entity", qRemoval, qTitle, keepNav, method, { useLinkTitle: true, 
                formatContent: function(body) {
                    var retval = body.replace(/\\"/g, '"');
                    retval = retval.replace(/find(?:\s+)authorized(?:\s+)novels(?:\s+)in(?:\s+)webnovel(?:，|,\s+)faster(?:\s+)updates(?:，|,\s+)better(?:\s+)experience(?:，|,\s+)please(?:\s+)click(?:\s+)www\.webnovel\.com(?:\s+)for(?:\s+)visiting\.?/gi, "");

                    return retval;
                }
            } ),
            new HostDefinition(this, /readlightnovel\.co/i, ".chapter-entity", qRemoval, qTitle, keepNav, method, { useLinkTitle: true, 
                formatContent: function(body) {
                    var retval = body.replace(/\\"/g, '"');
                    retval = retval.replace(/find(?:\s+)authorized(?:\s+)novels(?:\s+)in(?:\s+)webnovel(?:，|,\s+)faster(?:\s+)updates(?:，|,\s+)better(?:\s+)experience(?:，|,\s+)please(?:\s+)click(?:\s+)www\.webnovel\.com(?:\s+)for(?:\s+)visiting\.?/gi, "");

                    return retval;
                }
            } ),

            
            new HostDefinition(this, /bestlightnovel\.com/i, ".vung_doc", qRemoval, ".menu_doc #menu_chap option[selected='selected']", keepNav, method,
                { useLinkTitle: true, 
                formatContent: function (body) {
                    var regex = /(?:(?:\.\+|\.)[a-z]){2,}/gi
                    var match = null;
                    while ((match = regex.exec(body)) !== null)
                    {
                        body = body.replace(match[0], match[0].replace(/(?:\.\+|\.)/g, ""));
                    }

                    body = body.replace(/\b([fF])\*ck\b/g, "$1uck").replace(/\bF\*CK\b/g, "FUCK");
                    body = body.replace(/([sS])h\*t\b/g, "$1hit").replace(/SH\*T\b/g, "SHIT");
                    body = body.replace(/\b([Bb])\*tch\b/g, "$1itch").replace(/\bB\*TCH\b/g, "BITCH");
                    body = body.replace(/\b([Bb])\*stard\b/g, "$1astard").replace(/\bB\*STARD\b/g, "BASTARD");

                    return body;
                } }),
            new HostDefinition(this, /fastnovel\.net\//i, ".box-player #chapter-body", "p:contains(' w e b n o v e l ')", qTitle, keepNav, method, { useLinkTitle: true, 
                formatContent: function (body) {
                    var regex = /(?:\.[a-z]){2,}/gi
                    var match = null;
                    while ((match = regex.exec(body)) !== null)
                    {
                        body = body.replace(match[0], match[0].replace(/\./g, ""));
                    }

                    body = body.replace(/\b([fF])\*ck\b/g, "$1uck").replace(/\bF\*CK\b/g, "FUCK");
                    body = body.replace(/([sS])h\*t\b/g, "$1hit").replace(/SH\*T\b/g, "SHIT");
                    body = body.replace(/\b([Bb])\*tch\b/g, "$1itch").replace(/\bB\*TCH\b/g, "BITCH");
                    body = body.replace(/\b([Bb])\*stard\b/g, "$1astard").replace(/\bB\*STARD\b/g, "BASTARD");

                    return body;
                } }),
                
            new HostDefinition(this, /novelonlinefull\.com\//i, ".vung_doc", qRemoval, qTitle, keepNav, method, {
                formatContent: function (body) {
                    var regex = /(?:\.[a-z]){2,}/gi
                    var match = null;
                    while ((match = regex.exec(body)) !== null)
                    {
                        body = body.replace(match[0], match[0].replace(/\./g, ""));
                    }
    
                    body = body.replace(/\b([fF])\*ck\b/g, "$1uck").replace(/\bF\*CK\b/g, "FUCK");
                    body = body.replace(/([sS])h\*t\b/g, "$1hit").replace(/SH\*T\b/g, "SHIT");
                    body = body.replace(/\b([Bb])\*tch\b/g, "$1itch").replace(/\bB\*TCH\b/g, "BITCH");
                    body = body.replace(/\b([Bb])\*stard\b/g, "$1astard").replace(/\bB\*STARD\b/g, "BASTARD");
    
                    return body;
                } }),

            //Partial of past functionality, but site is offline anyway.
            //new HostDefinition(this, /novelsnchill/i, ".entry-the-content", null, null, null, null),
            //Keep Wordpress near end
            new HostDefinition(this, /wordpress/i, ".entry-content, .post-content",
                "#jp-post-flair, .post-info",
                ".entry-title, .post-title h1", null, null),
        ];
    }

    async GenerateChapter(BookInfo, body, chapterName, LinkObj) {
        let me = this;
        BookInfo.epubChapter = this;
        let generationRule = {};

        this.GenerationRules.forEach((item, index) => {
            if (!generationRule.rule) {
                generationRule.results = item.Regex.exec(LinkObj.url);
                if (!!generationRule.results) {
                    generationRule.rule = item;
                }
            }
        });

        //Really special case. Additionally eliminate urls with this at end.
        //Could theoretically create a generation rule regarding this. Would need more changes though.
        let gdocIndex = LinkObj.url.indexOf("docs.google.com");
        if (gdocIndex > -1 && gdocIndex < 10) {
            if (LinkObj.url.indexOf("docs.google.com/file") > -1)
            {
                this.Parent.outputMessage(`Linked to Google Drive File instead of Doc. Unable to consume. Skipping ${chapterName||LinkObj.text}`, BookInfo.sentMsg);
                return {
                    title: chapterName||LinkObj.text,
                    data: `Linked to Google Drive File instead of Doc. Unable to consume. <a href="${LinkObj.url}">${chapterName||LinkObj.text||LinkObj.url}</a> was skipped.`,
                    verbose: false
                };
            }
            let retval = await this.GenerateGoogleDocs(BookInfo, chapterName, LinkObj, null, body);
            return retval;
        }
        else {
            try {
                let $ = cheerio.load(body);
                if (!!generationRule.rule) {
                    let rule = generationRule.rule;
                    if (!!rule.AdditionalParameters && rule.AdditionalParameters.rawText && !!rule.method)
                    {
                        return await rule.method(body, BookInfo, chapterName, LinkObj,
                            rule.Query_Content, rule.Query_Removal, rule.Query_Title, rule.keepNav,
                            rule.AdditionalParameters
                        );
                    }
                    if (!!rule.method) {
                        return await rule.method($, BookInfo, chapterName, LinkObj,
                            rule.Query_Content, rule.Query_Removal, rule.Query_Title, rule.keepNav,
                            rule.AdditionalParameters
                        );
                    }
                    else {
                        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj,
                            rule.Query_Content, rule.Query_Removal, rule.Query_Title, rule.keepNav,
                            null, rule.AdditionalParameters
                        );
                    }
                }
                else {
                    return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj);
                }
            }
            catch (ex) {
                logger.error(`An exception occured when generating a chapter. ${chapterName} [${LinkObj.url}]`);
                logger.error(ex.message);
                logger.error(ex.stack);
            }
        }
    }

    async GenerateGenericParentContent($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav)
    {
        let content = $(qContent).parent();
        return await BookInfo.epubChapter.GenerateGeneric($, BookInfo, chapterName, LinkObj, null, qRemoval, qTitle, keepNav, content);
    }

    async GenerateGeneric($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav, content, params) {
        let me = BookInfo.epubChapter;
        let callUri = LinkObj.url;
        let regexPattern = new RegExp(this.regexIgnoreGenericDomainsPattern, 'ig').exec(callUri);
        if (!!regexPattern) {
            this.Parent.outputMessage(`Skipping domain detected among ignore list: ${regexPattern[1]}`, BookInfo.sentMsg);
        }
        else {
            this.Parent.outputMessage(`${BookInfo.GetProgress()} ${LinkObj.text} - Parsing Generically.  (${this.Parent.GetSimpleUrlDesc(callUri)})`, BookInfo.sentMsg);
            try {
                //Remove common annoying elements
                //$(".entry-content .wpcnt, .entry-content .sharedaddy").prev().nextAll().remove();
                $(".google-auto-placed, noscript, script, .wpcnt, .sharedaddy, "
                    + ".saboxplugin-wrap, footer, .entry-footer, .wp-post-navigation,"
                    + " .postauthor, .entry-author, .contributor, .author-info,"
                    + " .adsbygoogle, code-block, .post-footer, .comments, .nav_chp_fi, .ta_c_bm,"
                    + " .wi_authornotes, .Zeno_FR_Widget, a[href*='patreon.com'],"
                    + " .nocopy, .entry-navigation, .blocked, .post-meta-data, .post-meta,"
                    + " .taxonomies, aside, #disqus_thread, .ezoic-ad, img[src^='//'],"
                    + " [style^='color:transparent'], [style^='font-size: 0px'], [style^='font-size:1%'],"
                    + " [style^='font-size: 1%'], .shareblanter"
                ).remove();
                //Noscript is generally not shown on page, so should not be in ebook.
                //saboxplugin-wrap seems to be a wordpress thing to denote details about the author of the blog

                //Removal of certain bad site links
                $("a[href*='facebook.com'], a[href*='twitter.com'], a[href*='whatsapp.com'], a[href*='line.me']").remove();

                if (!!params)
                {
                    if (!!params.removeAllAfter)
                    {
                        $(params.removeAllAfter).nextAll().remove();
                        if (params.removeAllAfterInclude)
                        {
                            $(params.removeAllAfter).remove();
                        }
                    }
                    if (!!params.useLinkTitle)
                    {
                        chapterName = LinkObj.text;
                    }

                    if (!!params.removalQuery && !!params.removalQueryRegex)
                    {
                        let queryText = $(params.removalQuery).text();
                        if (!!queryText)
                        {
                            var regex = new RegExp(params.removalQueryRegex, "ig");
                            let removalClass = regex.exec(queryText);
                            var lastClass = null;
                            while (!!removalClass && removalClass.length > 1 && removalClass != lastClass) {
                                $(removalClass[1]).remove();
                                lastClass = removalClass[1];
                                this.Parent.outputMessage(null, null, null, null, `${lastClass} removed.`);
                                removalClass = regex.exec(queryText);
                            }
                        }
                    }
                }

                if (!!qContent) {
                    if (Array.isArray(qContent)) {
                        me.getFirstElement($, qContent);
                    }
                    else {
                        content = $(qContent);
                    }
                }
                if (!content || content.length < 1) {
                    //Generate Content from common body values
                    content = me.getFirstElement($,
                        ".entry-content", ".entry", ".post", ".post-content", ".post-entry",
                        "#chp_contents", "#novel_honbun", ".blog-post-single-content",
                        "#content", "#page-content"
                    );
                }

                if (content.length < 1) {
                    this.Parent.outputMessage(`No recognized content structure detected: ${callUri}; falling back to largest body.`, BookInfo.sentMsg);
                    content = $("body");

                    while (content.children().length < 3) {
                        let largestChild = null;

                        content.children().each(function () {
                            if (!largestChild ||
                                this.children.length > largestChild.children.length) {
                                largestChild = this;
                            }
                        });

                        content = $(largestChild);
                    }
                }
                else {
                    //$(".entry-content a:contains('Chapter'), .entry-content a:contains('chapter')").remove();
                }

                if (!chapterName && !!qTitle) {
                    let header = $(qTitle)[0];
                    if (!!header) {
                        if (!!header.attribs)
                        {
                            chapterName = header.attribs.title;
                            if (!!chapterName)
                            {
                                chapterName = chapterName.trim();
                            }
                        }
                        //Double up on logic to look for empty string.
                        if (!chapterName)
                        {
                            header = $(header);
                            chapterName = header.text().trim();
                        }
                    }
                } 

                if (!chapterName) {
                    //Could create a method that uses content.parent.find instead.
                    let header = me.getFirstElement($,
                        ".entry-title", ".entry-header", ".title",
                        ".chapter-title", ".novel_subtitle", ".post-title"
                    );

                    if (header.length > 0) {
                        //Going with last to hopefully find last child element type.
                        let titleElement = header.last().text();
                        chapterName = titleElement
                            .replaceAll(/^\s*(­|[—–-])*\s*|\s*(­|[—–-])*\s*$/g, '')
                            .replace(BookInfo.SeriesName, '') //I wish this wasn't necessary
                            .trim();
                    }
                }

                if (!chapterName && content.children().first().prop("tagName").startsWith("H")) {
                    chapterName = content.children().first().text().replace(/^\s*(-|­)\s*|\s*(-|­)\s*$/g, '').trim();
                    content.children().first().remove();
                }

                if (!chapterName && !!$("title").text()) {
                    chapterName = $("title").text().trim();
                }

                if (!chapterName) {
                    chapterName = LinkObj.text;
                }

                while (!chapterName) {
                    console.log("Attempting last resort chapter name.");
                    chapterName = content.children().first().text().replace(/^\s*(-|­)\s*|\s*(-|­)\s*$/g, '').trim();

                    if (chapterName.length > 50) {
                        chapterName = chapterName.substr(50);
                    }
                    else {
                        content.children().first().remove();
                    }
                }

                //Remove qRemoval after getting title and all other relevant data.
                if (!!qRemoval) {
                    $(qRemoval).remove();
                }

                $ = cheerio.load(content.html());

                if (!keepNav) {
                    let navEntities = $("a:not([href^='#'])").filter((index, item) => {
                        let itemText = $(item).text().toLowerCase().trim();
                        let indexSum = 5 + itemText.indexOf("←") + itemText.indexOf("main")
                            + itemText.indexOf("next") + 1 + itemText.indexOf("project page")
                            + itemText.indexOf("toc") + itemText.indexOf("table of content")
                            + 1 + itemText.indexOf("⟵");
                        if (indexSum == 0) {
                            indexSum = 3 + itemText.indexOf("prev") + itemText.indexOf("→") + itemText.indexOf("⟶");
                        }

                        itemText = itemText.replace(/[^\w\s]/gi, '').replaceAll(" ", "").replace("ofcontents", "").replace("chapter", "")
                            .replace("previous", "prev").replace("table", "");
                        return (indexSum >= 1 && itemText.length < 6);
                    });
                    navEntities.remove();
                }

                $(".entry-header, .entry-title, header, footer").remove();

                //await this.ParseImages($, callUri, BookInfo);

                let UncleanChapterText = $.html();// content.html();

                let ChapterText = sanitizeHtml(UncleanChapterText, {
                    allowedTags: me.sanitizeAllowedTags,
                    allowedSchemesByTag: {
                        img: ['data', 'file', 'http', 'https']
                    }
                });

                ChapterText = ChapterText.replaceAll("&lt;", "&lt; ").replaceAll("&gt;", " &gt;");

                chapterName = chapterName.trim();
                this.Parent.outputMessage(`Generating Chapter: ${BookInfo.GetProgress()} ${chapterName}`, BookInfo.sentMsg);

                let lcChapterName = chapterName.toLowerCase();

                if (BookInfo.RepeatCount < 10 && lcChapterName.indexOf("403") > -1 && lcChapterName.indexOf("forbidden") > -1) {
                    BookInfo.RepeatUri = callUri;
                    BookInfo.RepeatCount++;
                    console.log(`403 encountered; attempting regeneration in 30 seconds. [Attempt ${BookInfo.RepeatCount}]`)
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
                else {
                    if (!!params && !!params.formatContent)
                    {
                        ChapterText = params.formatContent(ChapterText);
                    }

                    return (
                        {
                            title: chapterName,
                            data: ChapterText,
                            dirtyData: UncleanChapterText,
                            verbose: false
                        });
                }
            }
            catch (err) {
                this.Parent.outputMessage(`Failed to generate chapter: ${chapterName}.` + err, BookInfo.sentMsg);
                logger.error(`Failed to generate chapter: ${chapterName} ${callUri}. \r\n` + err);
            }
        }
    }


    async GenerateTigerTranslation($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        //this.this is referring to the caller passed into HostDefinition
        let me = BookInfo.epubChapter;
        let content = $(".the-content");
        content.find(".tiger-content").prev().remove();
        let links = content.find("a:contains('PAGE '), a:contains('Page '), a:contains('page ')");

        if (links.length > 0 && !!links[0].attribs.href) {
            let linkObj = BookInfo.CreateLinkObject($(links[0]));
            if (BookInfo.ChapterUrls.indexOf(linkObj) == -1) {
                me.Parent.outputMessage("Additional page found. Adding to list.");
                BookInfo.ChapterUrls.unshift(linkObj);
            }
            links.remove();
        }

        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, ".the-content", ".tiger-after-content", qTitle, keepNav);
    }

    async GenerateReadLightNovelOrg($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        let me = BookInfo.epubChapter;
        $ = cheerio.load("<body>\n" + $(qContent).html() + "\n</body>");

        //let titleElement = $(".ads-title").first().nextUntil("p").next("p");
        chapterName = LinkObj.text;

        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, ".hidden, #growfoodsmart", qRemoval, qTitle, keepNav);
    }

    async GenerateGenericRemoveHidden($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav, params) {
        let me = BookInfo.epubChapter;
        let hiddenItems = $(params.qHidden);
        let hiddenClassArray = hiddenItems
            .map(item => { return "." + hiddenItems[item].attribs["class"]; })
            .get();
        ////Distinct/unique logic below
        let hiddenClasses = hiddenClassArray
            .filter((elem, pos) => { return hiddenClassArray.indexOf(elem) == pos; })
            .join(", ");
        $(hiddenClasses).remove();
        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav);
    }

    async GenerateGenericRemoveParent($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav, params) {
        let me = BookInfo.epubChapter;
        $(params.qElement).parent().remove();
        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav);
    }

    async GenerateGenericRemoveEarly($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav, params) {
        let me = BookInfo.epubChapter;
        $(params.qElement).remove();
        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav);
    }

    async GenerateGenericBetweenHR($, BookInfo, chapterName, callUri, qContent, qRemoval, qTitle, keepNav) {
        //chapterName = $(".entry-title").text().trim();
        let me = BookInfo.epubChapter;
        let hRules = $(".entry-content hr");

        if (hRules.length > 1) {
            $(hRules[hRules.length - 1]).prev().nextAll().remove();
            $(hRules[0]).next().prevAll().remove();
        }

        return await me.GenerateGeneric($, BookInfo, chapterName, callUri);
    }



    async GenerateTigerTranslation($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        //this.this is referring to the caller passed into HostDefinition
        let me = BookInfo.epubChapter;
        let content = $(".the-content");
        content.find(".tiger-content").prev().remove();
        let links = content.find("a:contains('PAGE '), a:contains('Page '), a:contains('page ')");

        if (links.length > 0 && !!links[0].attribs.href) {
            let linkObj = BookInfo.CreateLinkObject($(links[0]));
            if (BookInfo.ChapterUrls.indexOf(linkObj) == -1) {
                me.Parent.outputMessage("Additional page found. Adding to list.");
                BookInfo.ChapterUrls.unshift(linkObj);
            }
            links.remove();
        }

        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, ".the-content", ".tiger-after-content", qTitle, keepNav);
    }

    async GenerateReadLightNovelOrg($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        let me = BookInfo.epubChapter;
        $ = cheerio.load("<body>\n" + $(qContent).html() + "\n</body>");

        //let titleElement = $(".ads-title").first().nextUntil("p").next("p");
        chapterName = LinkObj.text;

        return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj, ".hidden, #growfoodsmart", qRemoval, qTitle, keepNav);
    }

    //Google Docs functions fundamentally different from others, since it decompiles a zip.
    async GenerateGoogleDocs(BookInfo, chapterName, LinkObj, callUris, body) {
        let me = BookInfo.epubChapter;
        let callUri = LinkObj.url;
        this.Parent.outputMessage(`Google Docs Recognized. Retrieving ${LinkObj.text}`, BookInfo.sentMsg);
        
        let $ = cheerio.load(body);
        chapterName = chapterName || $("title").text().replace(" - Google Docs", "");
        let regexPattern = ".*docs\.google\.com/document/d/(.*)";
        //console.log(callUri);
        let regexResult = new RegExp(regexPattern, 'ig').exec(callUri);
        let DocId = regexResult[1].split("/")[0];
        //Rather than handling purely through regex, handle all situations for ending of url with additional potential components (edit or not);
        this.Parent.outputMessage(`Doc ID retrieved: ${DocId} for Chapter [${chapterName}]. Downloading HTML Archive.`, BookInfo.sentMsg);
        //Download chapter as Zip
        //Token not necessary for anon dl
        //Use Title from $
        let zipDownloadUri = `https://docs.google.com/document/export?format=zip&id=${DocId}&includes_info_params=true`;

        let zipFolderName = path.resolve(`${BookInfo.tempDir}/${DocId}`);
        //let zipFileName = `${zipFolderName}.zip`;

        if (!fs.existsSync(BookInfo.tempDir)) {
            fs.mkdirSync(BookInfo.tempDir);
        }
        if (!fs.existsSync(zipFolderName)) {
            fs.mkdirSync(zipFolderName);
        }

        let zipStream = stream.Writable();
        this.SetStreamWriterDefaults(zipStream);

        let requestPromise = new Promise((resolve, reject) => {
            var req = request(
                {
                    method: 'GET',
                    uri: zipDownloadUri,
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.97 Safari/537.11",
                        "Accept-Encoding": "gzip,deflate,sdch",
                        "encoding": "null",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Cookie": "cookie"
                    }
                }
            );
            let continueRequst = false;
            req.pipe(zipStream);
            me.Parent.outputMessage(`${chapterName} successfully retrieved. [${DocId}]`, BookInfo.sentMsg);

            req.on("end", () => {
                continueRequst = true;
                me.Parent.outputMessage(`Parsing chapter ${chapterName} [${DocId}]`, BookInfo.sentMsg);
                let zipFile = new pkgAdmZip(zipStream.data);
                zipFile.extractAllTo(zipFolderName, true);

                let htmlEntries = zipFile.getEntries()
                    .filter(entry => entry.entryName.indexOf(".html") > 0);

                if (htmlEntries.length > 0) {
                    //Open first HTML file in zip.
                    let htmlContents = fs.readFileSync(`${zipFolderName}/${htmlEntries[0].entryName}`).toString();

                    let $ = cheerio.load(htmlContents);

                    //await me.ParseImages($, callUri, BookInfo);

                    //Set chapter HTML.
                    let ChapterText = $("body").html();
                    ChapterText = `<body> ${ChapterText} </body>`;
                    //ChapterText = "NULL";

                    // ChapterText = sanitizeHtml(ChapterText, {
                    //     allowedTags: sanitizeAllowedTags
                    // });
                    chapterName = chapterName.trim();
                    me.Parent.outputMessage("Generating Chapter: " + chapterName, BookInfo.sentMsg);

                    resolve(
                        {
                            title: chapterName,
                            data: ChapterText,
                            verbose: false
                        });
                }
                else {
                    reject(response);
                    me.Parent.outputMessage("Error Generating Chapter: " + chapterName, BookInfo.sentMsg);
                }
            });
        });
        return await requestPromise;
    }


    //God this sites logic is ugly, but it just doesn't fit in generic.
    async GenerateZirusMusings($, BookInfo, titlePassedIn, LinkObj) {
        let callUri = LinkObj.url;
        let me = BookInfo.epubChapter;
        $($(".entry-content .wpcnt, #eaa_post_after_content, .sharedaddy")[0]).prev().prev().nextAll().remove();
        //$(".sharedaddy")[0] ///SAME AS ABOVE
        $(".google-auto-placed").remove();
        $("noscript").remove();

        //await this.ParseImages($, callUri, BookInfo);

        //console.log($(".elementor-row")[2]);
        let content = $($($(".elementor-row")[5]).find(".elementor-widget-container")[1]);

        let largestChild = null;

        for (let index in content.toArray()) {
            let item = content[index];
            if (!largestChild ||
                item.children.length > largestChild.children.length) {
                largestChild = item;
            }
        }

        content = $(largestChild);

        let chapterName = titlePassedIn;

        if (!chapterName) {
            let header = $(".entry-header");

            if (!!header) {
                chapterName = header.children().first().text()
                    .replace(/^\s*(-|­)\s*|\s*(-|­)\s*$/g, '').trim();
            }
        }


        if (!chapterName && !!$("title").text()) {
            chapterName = $("title").text().replace(" – Ziru's Musings", "");
        }

        while (!chapterName) {
            chapterName = content.children().first().text().replace(/^\s*(-|­)\s*|\s*(-|­)\s*$/g, '').trim();
            content.children().first().remove();
        }

        chapterName = chapterName.trim();

        me.Parent.outputMessage("Generating Chapter: " + chapterName, BookInfo.sentMsg);

        //content.children().last().remove(); //Remove the chapter navigation.
        let ChapterText = content.html();

        let opts = {
            doctype: 'strict', //'html5',
            hideComments: true,
            indent: true,
            clean: true,
            dropEmptyElements: true,

        };

        let cleanChapterText = sanitizeHtml(ChapterText, {
            allowedTags: me.sanitizeAllowedTags,
            allowedSchemesByTag: {
                img: ['data', 'file', 'http', 'https']
            }
        });

        chapterName = chapterName.trim();
        return (
            {
                title: chapterName,
                data: cleanChapterText,
                UncleanChapterText: ChapterText,
                verbose: false
            });

    }

    async GenerateBakaTsuki($, BookInfo, titlePassedIn, LinkObj) {
        let me = this.this;
        let callUri = LinkObj.url;
        let hostname = "https://" + this.this.Parent.ExtractHostname(callUri);

        let images = $("a img.thumbimage");

        for (let index in images.toArray()) {
            let item = images[index];
            let img = $("<img />");
            let imgSrc = item.attribs.src;

            if (imgSrc.indexOf("/") < 2) {
                imgSrc = hostname + imgSrc;
            }

            let newWidth = item.attribs["data-file-width"] - 1 || "";

            let fileName = `${BookInfo.tempDir}/${this.this.Parent.GetParam("f", imgSrc)}`;

            if (!fs.existsSync(BookInfo.tempDir)) {
                fs.mkdirSync(BookInfo.tempDir);
            }

            let file = fs.createWriteStream(fileName);
            let request = https.get(this.this.Parent.ChangeParam("width", imgSrc, newWidth), function (response) {
                response.pipe(file);
            });


            img.attr("src", `${process.cwd()}/${fileName}`);
            $(item).parent().parent().parent().replaceWith(img);
        };


        //console.log(callUri);
        $(".mw-editsection").remove();
        let TitleElement = $(".mw-headline")[0];

        let chapterName = titlePassedIn;

        if (!!TitleElement && $(TitleElement).length > 0 && $(TitleElement).text()) {
            chapterName = $(TitleElement).text();
        }

        if (!!TitleElement) {
            $(TitleElement.parent.next).prevAll().remove();
        }
        else {
            TitleElement = $("#firstHeading");
            //Duplication for laziness in this case.
            if (!!TitleElement && $(TitleElement).length > 0 && $(TitleElement).text()) {
                chapterName = $(TitleElement).text();
            }
        }


        let lastEntry = $(".mw-references-wrap").last();

        if (lastEntry.length > 0) {
            lastEntry.prev().prev().nextAll().remove();
        }
        else {
            lastEntry = $("#mw-content-text a").last().closest("table");
            lastEntry.prev().prev().prev().nextAll().remove();
        }

        $(".wikitable").remove();
        $("a[href^='/']").remove();

        let ChapterText = $("#mw-content-text").html();
        let opts = {
            doctype: 'strict', //'html5',
            hideComments: true,
            indent: true,
            clean: true,
            dropEmptyElements: true,

        };
        
        ChapterText = sanitizeHtml(ChapterText, {
            allowedTags: me.sanitizeAllowedTags,
            allowedSchemesByTag: {
                img: ['data', 'file', 'http', 'https']
            }
        });

        chapterName = chapterName.trim();
        this.this.Parent.outputMessage("Generating Chapter: " + chapterName, BookInfo.sentMsg);

        //logger.info(ChapterText);

        return (
            {
                title: chapterName,
                data: ChapterText,
                verbose: false
            });
    }

    //Oh hell no, please, don't look at these two! I'll cry! Too many special cases!
    async GenerateBlogspotChapter($, BookInfo, titlePassedIn, LinkObj) {
        let me = BookInfo.epubChapter;
        let callUri = LinkObj.url;
        me.Parent.outputMessage(`Blogger style recognized: ${me.Parent.GetSimpleUrlDesc(callUri)} - Parsing`, BookInfo.sentMsg);
        let bloggerRegexPattern = "(.+?\.blog.+?(?:\.[a-z]+))/.*";
        let bloggerRegex = new RegExp(bloggerRegexPattern, 'ig').exec(callUri);

        //console.log(callUri);
        let feedLink = `${bloggerRegex[1]}/feeds/posts/default`;

        let postRegexPattern = "feeds/(\\d+)/comments/default";
        let body = $.html();
        let postId = new RegExp(postRegexPattern, 'ig').exec(body);

        //$(".entry-content").text().length < 2000 may break this at times?
        if (!!postId && $(".entry-content").text().length < 2000) {
            postId = postId[1];
            let entries = me.blogspotEntries[feedLink];

            if (!entries) {
                return await new Promise(resolve => {
                    request.get(feedLink, async function (err, res, feedBody) {
                        xml2js.parseString(feedBody, function (err, result) {
                            entries = result.feed.entry;
                        });
                        resolve(await me.GenerateBlogspotChapterEntry(entries, BookInfo, titlePassedIn, postId, body, LinkObj));
                    });
                });
            }
            else {
                return await me.GenerateBlogspotChapterEntry(entries, BookInfo, titlePassedIn, postId, body, LinkObj);
            }
        }
        else {
            return await me.GenerateGeneric($, BookInfo, titlePassedIn, LinkObj);
        }


    }
    async GenerateBlogspotChapterEntry(entries, BookInfo, chapterName, postId, body, LinkObj) {
        let me = BookInfo.epubChapter;
        let callUri = LinkObj.url;
        me.Parent.outputMessage(`Blogger Entry requested...`, BookInfo.sentMsg);
        let entry = entries.filter(entry =>
            entry.id.filter(pid => pid.indexOf(postId) > 0).length > 0)[0];

        if (!!entry && !!entry.content[0] && entry.content[0]) {
            let $ = cheerio.load(`<body>${entry.content[0]["_"]}</body>`);
            let content = $("body");

            if (!chapterName) {
                chapterName = entry.title[0]["_"];
            }

            while (!chapterName) {
                chapterName = content.children().first().text().replace(/^\s*(-|­)\s*|\s*(-|­)\s*$/g, '').trim();
                console.log(`Last Resort Chapter Name: [${chapterName}]`);
                content.children().first().remove();
            }

            let ChapterText = content.html();

            ChapterText = sanitizeHtml(ChapterText, {
                allowedTags: me.sanitizeAllowedTags,
                allowedSchemesByTag: {
                    img: ['data', 'file', 'http', 'https']
                }
            });

            chapterName = chapterName.trim();
            me.Parent.outputMessage("Generating Chapter: " + chapterName, BookInfo.sentMsg);

            return (
                {
                    title: chapterName,
                    data: ChapterText,
                    verbose: false
                });

        }
        else {
            me.Parent.outputMessage(`Blogger Entry not found! Reverting to Generic Parsing.`, BookInfo.sentMsg);
            let $ = cheerio.load(body);
            return await me.GenerateGeneric($, BookInfo, chapterName, LinkObj);
        }
    }

    //This one isn't far off from generic, but probably isn't worth the effort for the workaround
    async GenerateNovelFull($, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        let callUri = LinkObj.url;
        $(".adsmobiletop, .adsbygoogle, ins, script").remove();
        let content;

        if (!!qContent) {
            content = $(qContent);
        }

        content = content || $(".cha-content");

        if (!chapterName && !!qTitle) {
            let header = $(qTitle)[0];
            if (!!header) {
                header = $(header);
                chapterName = header.text().trim();
            }
        }

        if (!content || content.text().length < 100) {
            $(".cha-tit").last().remove();
            $(".adsmobiletop").next().remove();

            content = $('#chapter-content');
        }

        chapterName = (chapterName || $(".chapter-title").text()).trim();

        //Remove qRemoval after getting title and all other relevant data.
        if (!!qRemoval) {
            $(qRemoval).remove();
        }

        content.children()
            .filter((index, item) => { return $(item).text().trim().toLowerCase() === chapterName.toLowerCase(); })
            .remove();

        let footerText = content.find(":contains('report chapter'):contains('you find any errors')"
            + ":contains('lease let us know'):contains('so we can fix it as soon as possible')").last();

        if (!!footerText) {
            footerText.remove();
        }

        //await this.ParseImages($, callUri, BookInfo);

        let ChapterText = content.html();

        if (!ChapterText) {
            throw new Error("No text found for this chapter! Is the URL Correct?");
        }

        return (
            {
                title: chapterName.trim(),
                data: ChapterText,
                verbose: false
            });
    }

    async GenerateWebNovel(text, BookInfo, chapterName, LinkObj, qContent, qRemoval, qTitle, keepNav) {
        var data = JSON.parse(text);
        var chapterInfo = data.data.chapterInfo;

        var ChapterText = chapterInfo.contents.map((item, index) => {
            if (item.content.indexOf("<") == 0)
            {
                return item.content;
            }
            return "<p>"+htmlencode.htmlEncode(item.content.trim())+"</p>";
        }).join("\n");

        return (
            {
                title: chapterInfo.chapterName || chapterName || LinkObj.text,
                data: `<body>
                ${ChapterText}
                </body>`,
                verbose: false
            });
    }

    //////////////////////////////////////
    isImageExt(path) {
        let lpath = path.toLowerCase();
        return lpath.endsWith(".jpg")
            || lpath.endsWith(".jpeg")
            || lpath.endsWith(".png")
            || lpath.endsWith(".gif")
            || lpath.endsWith(".bmp");
    }

    getImageExt(path) {
        if (this.isImageExt(path)) {
            return path.split('.').pop();
        }
    }

    getFirstElement($) {
        let queries = Array.from(arguments).splice(1);
        let retval;
        if (Array.isArray(queries[0]) && queries.length == 1) {
            queries = queries[0];
        }
        queries.forEach(item => {
            if (!retval || retval.length < 1) {
                retval = $(item);
            }
        });
        return retval;
    }

    Delay(t, val) {
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(val);
            }, t);
        });
    }

    SetStreamWriterDefaults(streamWriter) {
        streamWriter.data = new Buffer('');
        streamWriter._write = function (chunk, enc, cb) {
            var buffer = (Buffer.isBuffer(chunk)) ?
                chunk :  // already is Buffer use it
                new Buffer(chunk, enc);  // string, convert

            // concat to the buffer already there
            this.data = Buffer.concat([this.data, buffer]);
            cb();
        }
    }
}

class HostDefinition {
    constructor(caller, regex, qContent, qRemoval, qTitle, keepNav, method, methodParams) {
        this.this = caller;
        this.Regex = regex;
        this.Query_Content = qContent;
        this.Query_Removal = qRemoval;
        this.Query_Title = qTitle;
        this.keepNav = keepNav;
        this.method = method;
        this.AdditionalParameters = methodParams;
    }

}

module.exports = epubChapter;