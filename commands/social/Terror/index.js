const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

class Terror {
    constructor() { }

    async Perseguir(client, msg) {
        try {
            let perseguir = Math.floor(Math.random() * 4);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/perseguir/${perseguir}.gif`;

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
                .setImage(dir)
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
            let perseguir = Math.floor(Math.random() * 16);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/miedo/${perseguir}.gif`;

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
                .setImage(dir)
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
            let perseguir = Math.floor(Math.random() * 19);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/asustar/${perseguir}.gif`;

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
                .setImage(dir)
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
            let llorar = Math.floor(Math.random() * 28);
            if (llorar == 0) {
                llorar = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/llorar/${llorar}.gif`;

            // console.log(llorar);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} empezo a llorar`)
                // .setDescription("list of all commands")
                .setColor(color)
                .setImage(dir)
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