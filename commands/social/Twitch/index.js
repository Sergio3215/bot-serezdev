const { Util } = require("../../util/index.js");

const util = new Util();

class Twitch {
    constructor() { }

    async Gay(msg, userIsSubOrBooster) {
        const member = await msg.guild.members.fetch(msg.author.id);

        if (!(await userIsSubOrBooster(member)) && msg.guild.id !== "748652112485023854") {
            return msg.reply("Este comando solo es para subs de Twitch o boosters del servidor.");
        }

        let percent = Math.floor(Math.random() * 100);

        const { reciver, comment } = util.getCommentAndReciver(msg, percent, '¡Onda se la re come!');

        msg.reply(`<@${reciver}> tiene un ${percent}% de ser re gay. ${comment}`);
    }

    async Gaga(msg, userIsSubOrBooster) {
        util.syncGif();

        const member = await msg.guild.members.fetch(msg.author.id);

        if (!(await userIsSubOrBooster(member)) && msg.guild.id !== "748652112485023854") {
            return msg.reply("Este comando solo es para subs de Twitch o boosters del servidor.");
        }

        let percent = Math.floor(Math.random() * 100);

        const { reciver, comment } = util.getCommentAndReciver(msg, percent, '¡Onda le re falla al flaco o a la flaca!');


        msg.reply(`<@${reciver}> tiene un ${percent}% de gaga. ${comment}`);
    }

    async MeMide(msg) {
        let cm = Math.floor(Math.random() * 30);
        msg.reply(`Te mide ${cm} cm`);
    }
}

module.exports = {
    Twitch
}