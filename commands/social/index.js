const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const { Util } = require("../util/index.js");

const util = new Util();


class Social {
    constructor() { }

    async Pensar(client, msg) {
        try {
            let pensar = Math.floor(Math.random() * 36);

            if (pensar == 0) {
                pensar = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} esta pensando`;

            let folder = "pensar"

            if (msg.content.includes('<@')) {
                pensar = Math.floor(Math.random() * 16);

                if (pensar == 0) {
                    pensar = 1;
                }

                folder = "pensar-alguien"

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = pensar > 5 ? `${memberName} esta pensando en ${reciverName}` : `${memberName} esta pensando en su toxic@ ${reciverName}`;
            }


            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${pensar}.gif`;

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

    async FelizCumple(client, msg) {
        try {
            let fc = Math.floor(Math.random() * 36);

            if (fc == 0) {
                fc = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            let folder = "FelizCumple"

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

                let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${fc}.gif`;

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

    async Choca5(client, msg) {
        try {
            let chocar5 = Math.floor(Math.random() * 20);

            if (chocar5 == 0) {
                chocar5 = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = util.ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            let folder = "chocar5"

            if (msg.content.includes('<@')) {

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                str = `${memberName} choco los 5 con ${reciverName}`;

                let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${folder}/${chocar5}.gif`;

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
}

module.exports = {
    Social
}