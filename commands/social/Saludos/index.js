const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

class Saludos {
    constructor() { }

    async Saludar(client, msg) {
        try {
            let saludar = Math.floor(Math.random() * 34);

            if (saludar == 0) {
                saludar = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} esta **saludando a todos**`;

            let folder = "saludar"

            if (msg.content.includes('<@')) {
                saludar = Math.floor(Math.random() * 15);

                if (saludar == 0) {
                    saludar = 1;
                }

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} esta saludando a ${reciverName}`;
            }


            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${saludar}.gif`;

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

    async Despedirse(client, msg) {
        try {
            let despedirse = Math.floor(Math.random() * 28);

            if (despedirse == 0) {
                despedirse = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} se esta **despidiendo de todos**`;

            let folder = "despedirse"

            if (msg.content.includes('<@')) {
                despedirse = Math.floor(Math.random() * 15);

                if (despedirse == 0) {
                    despedirse = 1;
                }

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} esta despidiendose de ${reciverName}`;
            }


            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${despedirse}.gif`;

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
}

module.exports = {
    Saludos
}