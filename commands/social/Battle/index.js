const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket, ContadorCommand, Gifs } = require("../../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../../util/index.js");

const util = new Util();

const db_gif = new Gifs();

class Battle {
    constructor() { }

    async Duelo(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "duelo");
            let count = gif[0].order - 1;
            let duelo = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

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

                let dir = gif.filter(g => g.order == duelo + 1);

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
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "enojo");
            let count = gif[0].order - 1;
            let enojarse = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = enojarse < 34 ? `${memberName} esta enojad@ con todos!` : `${memberName} esta tan enojad@ que esta pensando en matar a todos!`;

            if (msg.content.includes('<@')) {
                enojarse = Math.floor(Math.random() * count);

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = enojarse < 34 ? `${memberName} esta enojad@ con ${reciverName}!` : `${memberName} tiene tanto enojo con ${reciverName} que esta pensando en matarle!`;
            }


            let dir = gif.filter(g => g.order == enojarse + 1);

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
            console.log(error);
            await msg.reply("Hubo un error, contacta al creador del bot");
        }
    }

    async Golpear(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "golpe");
            let count = gif[0].order - 1;
            let golpe = Math.floor(Math.random() * count);
            let dir = gif.filter(g => g.order == golpe + 1);

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
    Battle
}