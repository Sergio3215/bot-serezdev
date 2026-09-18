const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

class Romance {
    constructor() { }

    async Pareja(client, msg) {
        try {
            let memberOne = await util.PersonaRandom(client, msg);
            // console.log(memberOne.user.globalName)

            let seccionRand = Math.floor(Math.random() * 3);

            let seccion = seccionRand == 1 ?
                "abrazo"
                :
                seccionRand == 2 ?
                    "besar"
                    :
                    seccionRand == 3 ?
                        "perseguir"
                        :
                        "besar"


            let count = seccion == "abrazo" ? 32
                :
                seccion == "besar" ?
                    36 : 4;

            let actionCount = Math.floor(Math.random() * count);
            if (actionCount == 0) {
                actionCount = 1;
            }

            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${seccion}/${actionCount}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = memberOne.user.id;
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            // if (reciverName == "null" || reciverName == null) {
            //     return this.Pareja(client, msg, EmbedBuilder, Colors);
            // }

            // console.log(reciverName);

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} es 100% compatible con ${reciverName}`)
                // .setDescription("list of all commands")
                .setColor(color)
                .setImage(dir)
            // .addFields(
            //     comandos_helper
            // )
            await msg.reply({
                embeds: [embed]
            });

            // msg.reply(`<@${memberOne.user.id}>`);
        } catch (error) {
            console.log(error);
            await msg.reply("Error al buscar pareja, intenta de nuevo.");
        }
    }

    async Nalguear(client, msg) {
        try {
            let perseguir = Math.floor(Math.random() * 8);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/nalguear/${perseguir}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} ha nalgueado a ${reciverName}`)
                .setColor(color);

            if (dir) {
                embed.setImage(dir);
            }

            await msg.reply({
                embeds: [embed]
            });
        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

    async Sonrojar(client, msg) {
        let dir = await gifts.getRandomGif(msg.guild.id, "sonrojar");

        const guild = await client.guilds.cache.get(msg.guild.id);
        let member = await guild.members.fetch(msg.author.id);

        let color = util.ColorRandom(Colors);

        let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

        const embed = new EmbedBuilder()
            .setTitle(`${memberName} se ha sonrojado`)
            .setColor(color);

        if (dir) {
            embed.setImage(dir);
        }

        await msg.reply({
            embeds: [embed]
        });
    }

    async Besar(client, msg) {
        try {
            let dir = await gifts.getRandomGif(msg.guild.id, "besar");

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le dio un beso a ${reciverName}`)
                .setColor(color);

            if (dir) {
                embed.setImage(dir);
            }

            await msg.reply({
                embeds: [embed]
            });
        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

    async Abrazar(client, msg) {
        try {
            let dir = await gifts.getRandomGif(msg.guild.id, "abrazo");

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le abrazó a ${reciverName}`)
                .setColor(color);

            if (dir) {
                embed.setImage(dir);
            }

            await msg.reply({
                embeds: [embed]
            });
        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

}

module.exports = {
    Romance
};