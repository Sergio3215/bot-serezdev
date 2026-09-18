const { Gifs } = require("../../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../util/index.js");

const util = new Util();

const db_gif = new Gifs();


class Social {
    constructor() { }

    async Pensar(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "pensar");
            let count = gif[0].order - 1;
            let pensar = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} esta pensando`;

            if (msg.content.includes('<@')) {
                gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "pensar-alguien");
                count = gif[0].order - 1;
                pensar = Math.floor(Math.random() * count);

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = pensar > 5 ? `${memberName} esta pensando en ${reciverName}` : `${memberName} esta pensando en su toxic@ ${reciverName}`;
            }


            let dir = gif.filter(g => g.order == pensar + 1);

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

    async FelizCumple(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "FelizCumple");
            let count = gif[0].order - 1;
            let fc = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            if (msg.content.includes('<@')) {

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                let atrasado = "";

                if (msg.content.includes("--")) {
                    if (msg.content.split("--")[1].trim().toLowerCase().includes("atrasado")) {
                        atrasado = "(atrasado)";
                    }
                }

                str = `${memberName} desea un 🎉¡Feliz cumpleaños ${atrasado} a ${reciverName}! 🎂`;

                let dir = gif.filter(g => g.order == fc + 1);

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

    async Choca5(client, msg) {
        try {
            let gif = await db_gif.getGifsByInteractionByName(msg.guild.id, "chocar5");
            let count = gif[0].order - 1;
            let chocar5 = Math.floor(Math.random() * count);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            if (msg.content.includes('<@')) {

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} choco los 5 con ${reciverName}`;

                let dir = gif.filter(g => g.order == chocar5 + 1);

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
}

module.exports = {
    Social
}