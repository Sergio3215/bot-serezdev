const { Server, SettingWelcome, buttonFollowing, aceptRules, setTicket } = require("../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const settingWelcome = new SettingWelcome();
const btnfollow = new buttonFollowing();
const acept_rules = new aceptRules();
const set_ticket = new setTicket();

class LibsCommands {

    constructor() {

    }

    async MeMide(msg) {
        let cm = Math.floor(Math.random() * 30);
        msg.reply(`Te mide ${cm} cm`);
    }

    async ConsultingGemini(msg, Consulting) {
        try {
            if (msg.author.id !== "1312903712238469170") {
                if (msg.content.includes('!') && msg.channel.id == "1312924103971438654") {
                    let command = msg.content.split('!')[1];
                    if (command.toLowerCase().includes('consulta')) {
                        msg.channel.send("Pensando...");
                        let petitions = command.split('consulta')[1].trim();
                        let messageGemini = await Consulting(petitions);
                        msg.reply(messageGemini);
                    }
                }
                else {
                    if (msg.channel.id != "1235165837317505075") {
                        msg.delete();
                        msg.channel.send("Comando No Valido, o Canal Incorrecto");
                    }
                }
            }
        } catch (error) {
            console.log(error.message);
            msg.reply('No entendi tu pedido');
        }
    }

    async setWelcome(msg) {
        const roleData = msg.content.split('!setwelcome')[1].trim();
        if (roleData.includes('<@') && roleData.includes('>')) {

            const roleId = roleData.split('<@&')[1].split('>')[0];
            const role = msg.guild.roles.cache.get(roleId);

            if (role) {
                let dto = (await settingWelcome.GetById(msg.guild.id));
                let dtoSettingWelcome = dto.length > 0;
                if (dtoSettingWelcome) {
                    let options = {
                        id: dto[0].id,
                        role: role.id,
                    }
                    settingWelcome.Update(options);
                    msg.reply(`El rol <@&${role.id}> ha sido modificado como el rol de bienvenida.`);
                }
                else {
                    settingWelcome.Create(msg.guild.id, role.id);
                    msg.reply(`El rol <@&${role.id}> ha sido establecido como el rol de bienvenida.`);
                }
            }
            else {
                msg.reply('No se encontró el rol especificado.');
            }
        }
        else {
            msg.reply('No es un rol valido');
        }
    }

    async SettingsButton(client, msg) {
        const channelData = msg.content.split('!setfollowing')[1].trim();
        if (channelData.includes('<#') && channelData.includes('>') && channelData.includes('<@&')) {
            try {
                let id = channelData.split('<#')[1].split('>')[0];
                let label_id = channelData.split('<#')[2].split('>')[0];

                let target_channel = await client.channels.fetch(id);

                let following = new ButtonBuilder()
                    .setCustomId('Following ' + label_id)
                    .setLabel('Seguir Sección')
                    .setStyle(ButtonStyle.Success);

                let row = new ActionRowBuilder()
                    .addComponents(following);

                target_channel.send({
                    content: `¿Deseas seguir el canal <#${label_id}>?`,
                    components: [row]
                });


                let rol_id = channelData.split('<@&')[1].split('>')[0];

                let options = {
                    id: msg.guild.id,
                    channel: label_id,
                    role: rol_id,
                }

                let db_update = (await btnfollow.GetById(msg.guild.id)).length > 0;

                if (!db_update) {
                    btnfollow.Create(options);
                    msg.reply(`El canal <#${label_id}> ha sido establecido como el canal a seguir.`);
                }
                else {
                    btnfollow.Update(options);
                    msg.reply(`El canal <#${label_id}> ha sido modificado como el canal a seguir.`);
                }

            }
            catch (error) {
                console.error(error);
                msg.reply('Debe enviarse el comando con el canal [target] y el canal [label]');
            }
            // const channel = msg.guild.channels.cache.get(channelId);
        }
        else {
            msg.reply('No es un canal o rol valido');
        }
    }


    async AceptRules(client, msg) {
        const channelData = msg.content.split('!setrules')[1].trim();
        if (channelData.includes('<#') && channelData.includes('>') && channelData.includes('<@&')) {
            try {
                let id = channelData.split('<#')[1].split('>')[0];
                let label_id = channelData.split('<#')[2].split('>')[0];

                let target_channel = await client.channels.fetch(id);

                let btn_rules = new ButtonBuilder()
                    .setCustomId('Rules ' + label_id)
                    .setLabel('Aceptar las reglas!')
                    .setStyle(ButtonStyle.Success);

                let row = new ActionRowBuilder()
                    .addComponents(btn_rules);

                target_channel.send({
                    content: `¿Deseas seguir el canal <#${label_id}>?`,
                    components: [row]
                });


                let remove_roleId = channelData.split('<@&')[1].split('>')[0];
                let set_roleId = channelData.split('<@&')[2].split('>')[0];

                let options = {
                    id: msg.guild.id,
                    channel: label_id,
                    role: set_roleId,
                    removeRole: remove_roleId
                }

                let db_update = (await acept_rules.GetById(msg.guild.id)).length > 0;

                if (!db_update) {
                    acept_rules.Create(options);
                    msg.reply(`El canal <#${label_id}> ha sido establecido como el canal para aceptar las reglas.`);
                }
                else {
                    acept_rules.Update(options);
                    msg.reply(`El canal <#${label_id}> ha sido modificado como el canal para aceptar las reglas.`);
                }

            }
            catch (error) {
                console.error(error);
                msg.reply('Debe enviarse el comando con el canal [target] y el canal [label] y dos roles [remove] y [set]');
            }
            // const channel = msg.guild.channels.cache.get(channelId);
        }
        else {
            msg.reply('No es un canal o rol valido');
        }
    }


    async TicketButtton(client, msg) {
        const channelData = msg.content.split('!settickets')[1].trim();
        if (channelData.includes('<#') && channelData.includes('>')) {
            try {
                let id = channelData.split('<#')[1].split('>')[0];
                let pending_id = channelData.split('<#')[2].split('>')[0];

                let target_channel = await client.channels.fetch(id);

                let btn_ticket = new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Crear Ticket')
                    .setStyle(ButtonStyle.Secondary);

                let row = new ActionRowBuilder()
                    .addComponents(btn_ticket);

                target_channel.send({
                    content: `¿Deseas crear un ticket?`,
                    components: [row]
                });

                let options = {
                    id: msg.guild.id,
                    requestChannel: id,
                    pendingChannel: pending_id,
                }

                let db_update = (await set_ticket.GetById(msg.guild.id)).length > 0;

                if (!db_update) {
                    set_ticket.Create(options);
                    msg.reply(`El canal <#${id}> ha sido establecido como creador de ticket.`);
                }
                else {
                    set_ticket.Update(options);
                    msg.reply(`El canal <#${id}> ha sido modificado como creador de ticket.`);
                }

            }
            catch (error) {
                console.error(error);
                msg.reply('Debe enviarse el comando con el  request [request] y el canal [pending]');
            }
            // const channel = msg.guild.channels.cache.get(channelId);
        }
        else {
            msg.reply('No es un canal o rol valido');
        }
    }


    //Nekotina Family Friendly

    #ColorRandom(Colors) {
        let num = Math.floor(Math.random() * 4);

        if (num == 0) {
            num = 1;
        }

        switch (num) {
            case 1:
                return Colors.Red;
                break;
            case 2:
                return Colors.Green;
                break;
            case 3:
                return Colors.Blue;
                break;
            case 4:
                return Colors.Black;
                break;
        }
    }

    async #PersonaRandom(client, msg) {
        const guild = await client.guilds.cache.get(msg.guild.id);
        let member = await guild.members.fetch();
        // console.log(member);
        let tempArr = [];
        member.map(m => {
            tempArr.push(m);
        })

        let oneMember = Math.floor(Math.random() * tempArr.length);

        // console.log(tempArr[oneMember].nickname);
        // console.log(tempArr[oneMember].user.globalName);

        return tempArr[oneMember]
    }

    async Golpear(client, msg) {
        try {
            let golpe = Math.floor(Math.random() * 7);
            if (golpe == 0) {
                golpe = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/golpe/${golpe}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

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

            let color = this.#ColorRandom(Colors);

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

    async Sonrojar(client, msg) {
        let sonrojar = Math.floor(Math.random() * 9);
        if (sonrojar == 0) {
            sonrojar = 1;
        }
        let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/sonrojar/${sonrojar}.gif`;

        const guild = await client.guilds.cache.get(msg.guild.id);
        let member = await guild.members.fetch(msg.author.id);

        let color = this.#ColorRandom(Colors);

        let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

        const embed = new EmbedBuilder()
            .setTitle(`${memberName} se ha sonrojado`)
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

    async Besar(client, msg) {
        try {
            let perseguir = Math.floor(Math.random() * 9);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/besar/${perseguir}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le dio un beso a ${reciverName}`)
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

    async Abrazar(client, msg) {
        try {
            let perseguir = Math.floor(Math.random() * 7);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/abrazo/${perseguir}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} le abrazó a ${reciverName}`)
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

    async Pareja(client, msg) {
        try {
            let memberOne = await this.#PersonaRandom(client, msg);
            // console.log(memberOne)

            let beso = Math.floor(Math.random() * 7);
            if (beso == 0) {
                beso = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/besar/${beso}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = memberOne.user.id;
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            if (reciverName == "null") {
                return this.Pareja(client, msg, EmbedBuilder, Colors);
            }

            const embed = new EmbedBuilder()
                .setTitle(`La pareja de ${memberName} es ${reciverName}`)
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
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

}
module.exports = LibsCommands;