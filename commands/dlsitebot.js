
// const fs = require('fs');
const Discord = require('discord.js')

// web crawler
const request = require('request');
const util = require('util');
const get = util.promisify(request.get);
const cheerio = require("cheerio");

let indexReg = /([RBV]J\d{6})/;

const getDLsitePage = async (index) => {
    let req, url;

    try {
        url = `https://www.dlsite.com/home/announce/=/product_id/${index}.html`;

        // request
        req = await get({ url });
        // retry
        if (req.body && req.statusCode != 200) {
            url = url.replace('announce', 'work')
            req = await get({ url });
        };
        if (!req.body || req.statusCode != 200) return null;
        // fs.writeFileSync(`./${index}.html`, req.body);  // save data

        let result = { index, url };

        // load html body
        let html = req.body;
        let $ = cheerio.load(html);
        let res;

        // price
        res = $('#right .work_buy_content .price');
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.text().trim();
            if (!temp || temp[0] == '{') { continue; }
            result.price = temp;
        }

        // schedule
        res = $('#right .work_buy_content .work_date_ana');
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.text().trim();
            if (!temp || temp[0] == '{') { continue; }
            result.schedule = temp;
        }

        // images
        result.thumb = [];
        res = $(".product-slider-data div");
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.attr('data-src');
            result.thumb.push(`https:${temp}`);
        }

        // title
        res = $("#work_name");
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.html();
            result.title = temp;
        }

        // maker
        result.table = [];
        res = $("#work_right_inner tr");
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.html().replace(/(\<[^\>]+\>)+/g, '\n').trim().split(/\s+/);
            let head = temp.shift();
            let body = temp.join(' ').replace('&nbsp;', ' ');
            if (head == 'サークル名') { body = body.replace(' フォローする', ''); }
            result.table.push([head, body]);
        }

        // maker url
        res = $("#work_maker a");
        for (let i = 0; i < res.length; i++) {
            const ele = res.eq(i);

            let temp = ele.attr('href');
            result.makerUrl = temp;
        }

        // check price again from maker page
        url = result.makerUrl.replace('=/', '=/per_page/100/');
        req = await get({ url });
        if (req.body && req.statusCode == 200) {
            // let [, mIndex] = url.match(/(RG\d{5})/);
            // fs.writeFileSync(`./${mIndex}.html`, req.body);  // save data

            // load html body
            let html = req.body;
            let $ = cheerio.load(html);

            let ele = $(`.search_result_img_box_inner > div[data-product_id=${index}]`).eq(0).prev();
            result.price = ele.find('.work_price_wrap .work_price').eq(0).text().trim() || result.price;
            result.strike = ele.find('.work_price_wrap .strike').eq(0).text().trim();
            result.point = ele.find('.work_price_wrap .work_point').eq(0).text().trim();
            result.deals = ele.children('.work_deals').eq(0).text().trim();
        }

        return result;
    } catch (e) {
        console.log(`statusCode = ${req.statusCode}`);
        console.log(e);

        if (req.body) {
            let html = req.body;
            let [, title] = (temp = html.match(/\<title\>(.*)\<\/title\>/)) ? temp : [, null];
            if (title) {
                console.log(`title= ${title}`);
                return null;
            }
        }
        return null;
    }
}

module.exports = {
    name: 'DLsiteBot',
    description: "get dl page data",
    async execute(message, args) {

        // check index code
        let arg = args.shift().toUpperCase();
        if (!indexReg.test(arg)) { return false; }
        let [, index] = arg.match(indexReg);

        // download dlsite page
        let result = await getDLsitePage(index), description = '';
        if (!result) { return false; }

        // build result embed
        if (result.schedule) { description += `発売予定日： ${result.schedule}`; }
        description += `\n**価格： ${result.price}**`;
        if (result.strike) { description += `  ~~${result.strike}~~`; }
        if (result.deals || result.point) {
            description += '```css\n'
            if (result.deals) { description += ` [${result.deals}]`; }
            if (result.point) { description += ` ${result.point}`; }
            description += '```';
        }
        for (let pair of result.table) {
            if (pair[0] == 'サークル名') {
                description += `\n${pair[0]}： [${pair[1]}](${result.makerUrl})`;
                continue;
            }
            description += `\n${pair[0]}： ${pair[1]}`;
        }

        const embed = new Discord.MessageEmbed()
            .setColor('#010d85')
            .setTitle(`${result.title} [${result.index}]`)
            .setURL(result.url)
            .setURL(result.url)
            .setDescription(description);

        let components;
        if (result.thumb) {
            // set img
            embed.setThumbnail(result.thumb[0]);
            embed.setImage(`${result.thumb[0]}`);

            // image switch button
            if (result.thumb.length > 1) {
                // get last img tag
                let [, imgTag] = result.thumb[1].match(/_img_([^\.\d]+)/);

                components = [new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle("PRIMARY")
                            .setLabel("|<")
                            .setCustomId("dlThumbMain")
                    )
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle("PRIMARY")
                            .setLabel("<<")
                            .setCustomId("dlThumbPrve")
                    )
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle("PRIMARY")
                            .setLabel(">>")
                            .setCustomId("dlThumbNext")
                    )
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle("PRIMARY")
                            .setLabel(">|")
                            .setCustomId(`dlThumbEnd ${imgTag} ${result.thumb.length}`)
                    )
                ];
            }
        }

        message.channel.send({ embeds: [embed], components }).catch(() => { });
        message.suppressEmbeds(true).catch(() => { });
        return true;
    },
    async interacted(interaction) {
        if (!interaction.isButton()) { return false; }
        if (!interaction.customId.startsWith("dlThumb")) { return false; }

        // get button parametet
        const msg = interaction.message;
        const embed = msg.embeds[0];
        const row = msg.components[0];
        let [, imgTag, imgLength] = row.components[3].customId.split(' ');    // _img_(smpa)(2)
        imgLength = parseInt(imgLength);

        // get image url data
        let imageUrl = embed.image.url;
        let [, oldTag] = imageUrl.match(/_img_([^\.]+)/);    // _img_(smpa2)
        let imgIndex = (oldTag == 'main' ? 0 : parseInt(oldTag.match(/(\d+)/)));
        // get new img index
        switch (interaction.customId) {
            case "dlThumbMain": { imgIndex = 0; } break;
            case "dlThumbNext": { imgIndex = (imgIndex + 1) % imgLength; } break;
            case "dlThumbPrve": { imgIndex = (imgIndex + imgLength - 1) % imgLength; } break;
            default: { imgIndex = imgLength - 1; } break;
        }
        // get new img tag
        let newTag = 'main';
        if (imgIndex != 0) { newTag = imgTag + imgIndex; }

        // set new img
        embed.setImage(imageUrl.replace(oldTag, newTag));
        // edit message
        msg.edit({ embeds: [embed], components: [row] });

        // mute reply
        interaction.reply({ content: ' ' }).catch(() => { });

        return true;
    },
    // async setup(client) {
    // }
}