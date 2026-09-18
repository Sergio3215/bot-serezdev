const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand, Gifs } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

const db_gif = new Gifs();

class Terror {
    constructor() { }

    async Perseguir(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "perseguir");
            let count = gif[0].order - 1;
            let perseguir = Math.floor(Math.random() * count);
            let dir = gif.filter(g => g.order == perseguir + 1);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le esta persiguiendo a ${reciverName}`)
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

    async Miedo(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "miedo");
            let count = gif[0].order - 1;
            let perseguir = Math.floor(Math.random() * count);
            let dir = gif.filter(g => g.order == perseguir + 1);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} tiene miedo`;

            if (msg.content.includes('<@')) {
                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;
                str = `${memberName} tiene miedo de ${reciverName}`;
            }

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

    async Asustar(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "asustar");
            let count = gif[0].order - 1;
            let perseguir = Math.floor(Math.random() * count);
            let dir = gif.filter(g => g.order == perseguir + 1);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} quiere intimidar a ${reciverName}`)
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

    async Llorar(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "llorar");
            let count = gif[0].order - 1;
            let llorar = Math.floor(Math.random() * count);
            let dir = gif.filter(g => g.order == llorar + 1);

            // console.log(llorar);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} empezo a llorar`)
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
    Terror
}