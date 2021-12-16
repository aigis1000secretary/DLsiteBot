const fs = require('fs');
const { DISCORD_TOKEN } = require('./config.js');
const { PREFIX } = require('./config.js');

// discord
const Discord = require('discord.js');
const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES"], partials: ["MESSAGE", "CHANNEL", "REACTION"] });
client.commands = new Discord.Collection();


// get text command
let pluginTypes = ['commands'];
for (let type of pluginTypes) {
    if (fs.existsSync(`./${type}/`)) {
        const pluginFiles = fs.readdirSync(`./${type}/`)
            .filter(file => file.endsWith('.js'));
        for (const file of pluginFiles) {

            const plugin = require(`./${type}/${file}`);
            plugin.type = type;
            client.commands.set(plugin.name, plugin);
        }
    }
}


// text command
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // let gID = message.guild ? `<${message.guild.name}> [${message.guild.id}]` : "Chat";
    // let cID = `<${message.channel.name}> [${message.channel.id}]`;
    // let uID = `<${message.author.username}> [${message.author.id}]`;
    // console.log(`\n${gID}\n${cID}\n${uID} : ${message.content.trim()}`);

    if (PREFIX.test(message.content)) {

        for (let [key, value] of client.commands) {
            if (!!value.execute && typeof (value.execute) == "function") {

                const args = message.content.slice(1).split(/\s+/);
                let result = await value.execute(message, args);
                // console.log(`${value.name.padEnd(20, ' ')}: ${result}`);
                if (result) { break; }
            }
        }
    }
});
client.on('interactionCreate', async (interaction) => {
    for (let [key, value] of client.commands) {
        if (!!value.interacted && typeof (value.interacted) == "function") {

            let result = await value.interacted(interaction);
            if (result) { break; }
        }
    }
});


client.once('ready', async () => {
    // dc bot online
    console.log('=====BOT is online!=====');

    // setup
    console.log(`setup plugins(${client.commands.size}):`);
    for (let [key, value] of client.commands) {
        if (!!value.setup && typeof (value.setup) == "function") {
            console.log(`  ${value.type.padEnd(8, ' ')}  ${value.name.padEnd(20, ' ')} <${value.description}>`);
            await value.setup(client);
        }
    }
    console.log(``);
});

// dc login
client.login(DISCORD_TOKEN);