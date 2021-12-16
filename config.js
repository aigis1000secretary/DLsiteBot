
// online bot cfg
module.exports = {
    DISCORD_TOKEN: process.env.DISCORD_BOT_TOKEN,

    // PREFIX: /^[\/\-!][\S]/,
    PREFIX: require('fs').existsSync("./debug.js") ? /^[!~][\S]/ : /^[!][\S]/,
}
