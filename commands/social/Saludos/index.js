const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand, Gifs } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

const db_gif = new Gifs();

class Saludos {
    constructor() { }

    async Saludar(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "saludar");
            let count = gif[0].order - 1;
            let saludar = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} esta **saludando a todos**`;

            if (msg.content.includes('<@')) {
                saludar = Math.floor(Math.random() * count);

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} esta saludando a ${reciverName}`;
            }


            let dir = gif.filter(g => g.order == saludar + 1);

            const embed = new EmbedBuilder()
                .setTitle(str)
                // .setDescription("list of all commands")
                .setColor(color)
                .setImage(dir[0].url)
            // .addFields(
            //     comandos_helper
            // )
            await msg.reply({
                embeds: [embed]
            });
        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

    async Despedirse(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "despedirse");
            let count = gif[0].order - 1;
            let despedirse = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} se esta **despidiendo de todos**`;

            if (msg.content.includes('<@')) {
                despedirse = Math.floor(Math.random() * count);

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} esta despidiendose de ${reciverName}`;
            }


            let dir = gif.filter(g => g.order == despedirse + 1);

            const embed = new EmbedBuilder()
                .setTitle(str)
                // .setDescription("list of all commands")
                .setColor(color)
                .setImage(dir[0].url)
            // .addFields(
            //     comandos_helper
            // )
            await msg.reply({
                embeds: [embed]
            });
        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }
}

module.exports = {
    Saludos
}