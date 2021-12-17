
// const fs = require('fs');
const Discord = require('discord.js')

// web crawler
const request = require('request');
const util = require('util');
const get = util.promisify(request.get);
const cheerio = require("cheerio");

let indexReg = /([RBV]J\d{6})/;

const getDLsitePage = async (index) => {
    console.log(index)
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

const createDLsitePageMessage = (result) => {

    // build result embed
    let description = '';
    if (result.schedule) {
        description += `発売予定日： ${result.schedule}`;
        description += `\n**予定価格： ${result.price}**`;
    } else {
        description += `**価格： ${result.price}**`;
    }
    if (result.strike) { description += `　  ~~${result.strike}~~`; } // 原価
    if (result.deals || result.point) {
        description += '```css\n'
        if (result.deals) { description += ` [${result.deals}]`; }
        if (result.point) { description += ` ${result.point}還元`; }
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
                        .setLabel(`1/${result.thumb.length}`)
                        .setCustomId("dlThumbNum")
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

    return { embeds: [embed], components };
}


module.exports = {
    name: 'DLsiteBot',
    description: "get dl page data",
    async execute(message, args) {

        // check index code
        let arg = args.shift().toUpperCase();
        if (!indexReg.test(arg)) { return false; }
        let [, index] = arg.match(indexReg);

        // get permissions
        let permissions = message.channel.permissionsFor(message.member.guild.me);
        // for (let key of ['SEND_MESSAGES', 'EMBED_LINKS', 'MANAGE_MESSAGES']) { console.log(key, permissions.has(key)) }
        // check permissions
        if (!permissions.has('SEND_MESSAGES')) {
            console.log('Missing Permissions: SEND_MESSAGES');
            return false;
        }
        if (!permissions.has('EMBED_LINKS')) {
            console.log('Missing Permissions: EMBED_LINKS');
            message.channel.send('Missing Permissions: EMBED_LINKS');
            return false;
        }

        // download dlsite page
        let result = await getDLsitePage(index);
        if (!result) { return false; }

        // create Message Payload
        let messagePayload = createDLsitePageMessage(result);
        message.channel.send(messagePayload).catch(console.log);

        // check manager permissions
        if (!permissions.has('MANAGE_MESSAGES')) {
            console.log('Missing Permissions: MANAGE_MESSAGES');
            return true;
        }
        message.suppressEmbeds(true).catch(console.log);

        return true;
    },
    async interacted(interaction) {
        if (!interaction.isButton()) { return false; }
        if (!interaction.customId.startsWith("dlThumb")) { return false; }

        // get button parameter
        const msg = interaction.message;
        // get old embeds
        const embed = msg.embeds[0];
        // get button row
        const row = msg.components[0];

        if (interaction.customId == "dlThumbNum" && embed.url) {
            // mute reply
            interaction.reply({ content: ' ' }).catch(() => { });

            let [, index] = embed.url.match(indexReg);

            // download dlsite page
            let result = await getDLsitePage(index);
            if (!result) { return true; }

            // create Message Payload
            let messagePayload = createDLsitePageMessage(result);
            // edit message
            msg.edit(messagePayload).catch(console.log);
            return true;
        }

        // check image parameter
        if (!embed || !embed.image) { return false; }
        let [, imgTag, imgLength] = row.components.find(btn => btn.customId.startsWith('dlThumbEnd')).customId.split(' ');
        imgLength = parseInt(imgLength);

        // get image url data
        let imageUrl = embed.image.url;
        let [, oldTag] = imageUrl.match(/_img_([^\.]+)/);    // _img_(smpa2)
        let imgIndex = (oldTag == 'main' ? 0 : parseInt(oldTag.match(/(\d+)/)));
        // get new img index
        switch (interaction.customId.split(' ')[0]) {
            case "dlThumbMain": { imgIndex = 0; } break;
            case "dlThumbNext": { imgIndex = (imgIndex + 1) % imgLength; } break;
            case "dlThumbPrve": { imgIndex = (imgIndex + imgLength - 1) % imgLength; } break;
            case "dlThumbEnd": { imgIndex = imgLength - 1; } break;
        }
        // get new img tag
        let newTag = 'main';
        if (imgIndex != 0) { newTag = imgTag + imgIndex; }

        // set new img
        embed.setImage(imageUrl.replace(oldTag, newTag));
        // edit button label
        let label = row.components.find(btn => btn.customId.startsWith('dlThumbNum'));
        if (label) { label.setLabel(`${imgIndex + 1}/${imgLength}`) }
        else {
            row.components.splice(2, 0,
                new Discord.MessageButton().setStyle("PRIMARY")
                    .setLabel(`${imgIndex + 1}/${imgLength}`)
                    .setCustomId("dlThumbNum")
            );
        }
        // edit message
        msg.edit({ embeds: [embed], components: [row] }).catch(console.log);

        // mute reply
        interaction.reply({ content: ' ' }).catch(() => { });

        return true;
    },
    // async setup(client) {
    // }
}