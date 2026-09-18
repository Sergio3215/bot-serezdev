const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

class Battle {
    constructor() { }

    async Duelo(client, msg) {
        try {
            let duelo = Math.floor(Math.random() * 22);

            if (duelo == 0) {
                duelo = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            let folder = "duelo"

            if (msg.content.includes('<@')) {

                let winner = Math.floor(Math.random() * 10);

                if (winner == 0) {
                    winner = 1;
                }

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;


                let winner_pj = winner % 2 == 0 ?
                    memberName
                    :
                    reciverName;

                str = `${memberName} desafio un duelo a ${reciverName} \n Y el ganador es ${winner_pj}`;

                let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${duelo}.gif`;

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
            }
            else {
                await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
            }


        } catch (error) {
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

    async Enojar(client, msg) {
        try {
            let enojarse = Math.floor(Math.random() * 79);

            if (enojarse == 0) {
                enojarse = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = enojarse < 34 ? `${memberName} esta enojad@ con todos!` : `${memberName} esta tan enojad@ que esta pensando en matar a todos!`;

            let folder = "enojo"

            if (msg.content.includes('<@')) {
                enojarse = Math.floor(Math.random() * 55);

                if (enojarse == 0) {
                    enojarse = 1;
                }

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = enojarse < 34 ? `${memberName} esta enojad@ con ${reciverName}!` : `${memberName} tiene tanto enojo con ${reciverName} que esta pensando en matarle!`;
            }


            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${enojarse}.gif`;

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
            console.log(error);
            await msg.reply("Hubo un error, contacta al creador del bot");
        }
    }

    async Golpear(client, msg) {
        try {
            let golpe = Math.floor(Math.random() * 35);
            if (golpe == 0) {
                golpe = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/golpe/${golpe}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le ha dado un golpe a ${reciverName}`)
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
    Battle
}