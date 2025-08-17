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

    async ConsultingGemini(msg, Consulting, userIsSubOrBooster) {
        try {

            const member = await msg.guild.members.fetch(msg.author.id);

            if (!(await userIsSubOrBooster(member))) {
                return msg.reply("Este comando solo es para subs de Twitch o boosters del servidor.");
            }

            let command = msg.content.split('!')[1];
            if (command.toLowerCase().includes('consulta')) {
                let msgChat = await msg.channel.send("Pensando");
                let petitions = command.split('consulta')[1].trim();

                let messageAI = '';

                const frases = ["Pensando.", "Pensando..", "Pensando..."];
                let idx = 0;

                const interval = setInterval(async () => {
                    idx = (idx + 1) % frases.length;
                    try {
                        if (messageAI !== '') {
                            await msgChat.edit(messageAI);
                            clearInterval(interval);
                        }
                        else {
                            await msgChat.edit(frases[idx]);
                        }
                    }
                    catch {

                    }
                }, 500);

                messageAI = await Consulting(petitions);
            }
        } catch (error) {
            console.log(error.message);
            msg.reply('No entendi tu pedido');
        }
    }

    async Personaje(msg, createCharacter, userIsSubOrBooster) {
        try {

            // const member = await msg.guild.members.fetch(msg.author.id);

            // if (!(await userIsSubOrBooster(member))) {
            //     return msg.reply("Este comando solo es para subs de Twitch o boosters del servidor.");
            // }

            let msgChat = await msg.channel.send("Pensando");



            const frases = ["Pensando.", "Pensando..", "Pensando..."];

            const frases2 = ["Cargando.", "Cargando..", "Cargando..."];
            let idx = 0;

            const pensando = setInterval(async () => {
                try {
                    idx = (idx + 1) % frases.length;
                    await msgChat.edit(frases[idx]);
                }
                catch {
                    clearInterval(pensando);
                    // return msgChat.edit("no se creo el pj");
                }
            }, 500);

            const { nombre, raza, clase, nivel, mision, estadisticas, historia, imagen, error } = await createCharacter();

            clearInterval(pensando);

            await msgChat.edit("Cargando")

            idx = 0;

            const cargando = setInterval(async () => {
                try {
                    idx = (idx + 1) % frases2.length;
                    await msgChat.edit(frases2[idx]);
                }
                catch {
                    clearInterval(cargando);
                    // return msgChat.edit("no se creo el pj");
                }
            }, 100);

            if (error !== '' && error !== undefined) {
                console.log('error')
                clearInterval(cargando);
                return await msgChat.edit(error);
            }

            console.log(estadisticas)

            let color = this.#ColorRandom(Colors);

            const embed = new EmbedBuilder()
                .setTitle(`Personaje ${nombre}`)
                .setDescription(`
                                Nivel:
                                ${nivel}

                                Estadisticas:
                                Fuerza: ${estadisticas.fuerza}
                                Destreza: ${estadisticas.destreza}
                                Constitucion: ${estadisticas.constitucion}
                                Inteligencia: ${estadisticas.inteligencia}
                                Sabiduria: ${estadisticas.sabiduria}
                                Carisma: ${estadisticas.carisma}

                                Clase:
                                ${clase}

                                Raza:
                                ${raza}

                                mision:
                                ${mision}

                                Historia:
                                ${historia}
                            `)
                .setColor(color)
                .setImage(imagen)
            // .addFields(
            //     comandos_helper
            // )

            // await msg.reply({
            //     embeds: [embed]
            // });

            clearInterval(cargando);

            await msgChat.edit({
                content: null,
                embeds: [embed]
            });

        } catch (error) {
            console.log(error);
        }
    }

    async Nivel(msg, userIsSubOrBooster) {

        // const member = await msg.guild.members.fetch(msg.author.id);

        // if (!(await userIsSubOrBooster(member))) {
        //     return msg.reply("Este comando solo es para subs de Twitch o boosters del servidor.");
        // }

        const estadisticas = this.#SubirNivel();

        msg.reply(`
Fuerza: ${estadisticas.fuerza}
Destreza: ${estadisticas.destreza}
Constitucion: ${estadisticas.constitucion}
Inteligencia: ${estadisticas.inteligencia}
Sabiduria: ${estadisticas.sabiduria}
Carisma: ${estadisticas.carisma}`)
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

    async Comandos(isMod, isAdmin, msg) {
        let comandos_helper = [
            { name: '!memide', value: "Dice la cantidad que te mide." },
            { name: '!golpear', value: "Tu golpeas a alguien cuando lo etiquetas. Ejemplo !golpear <name>" },
            { name: '!sonrojar', value: "Accion de sonrojarse" },
            { name: '!perseguir', value: "Tu persigues a alguien cuando lo etiquetas. Ejemplo !perseguir <name>" },
            { name: '!besar', value: "Tu besas a alguien cuando lo etiquetas. Ejemplo !besar <name>" },
            { name: '!abrazar', value: "Tu abrazas a alguien cuando lo etiquetas. Ejemplo !abrazar <name>" },
            { name: '!miedo', value: "Tu le temes al que etiquetes o tienes miedo. Ejemplo !miedo <name>" },
            { name: '!intimidar', value: "Tu intimidas a alguien cuando lo etiquetas. Ejemplo !intimidar <name>" },
            { name: '!nalguear', value: "Tu nalgueas a alguien cuando lo etiquetas. Ejemplo !nalguear <name>" },
            { name: '!llorar', value: "Tu lloras o lloras por alguien ejemplo !llorar <name>" },
            { name: '!pensar', value: "Tu pensas o pensas en alguien ejemplo !pensar <name>" },
            { name: '!pareja', value: "Te dice que pareja vas a tener :D" },
            { name: '!hi', value: "Tu saludas a todos o saludas a alguien ejemplo !hi <name>" },
            { name: '!bye', value: "Tu despides a todos o despedis a alguien ejemplo !bye <name>" },
            { name: '!fc', value: "Felicitas por su cumpleaños a alguien, agregando el atributo '--atrasado' puedes felicitar un cumpleaños atrasado. Por ejemplo: !fc <name> \n !fc --atrasado <name>" },
            { name: '!choquelos5', value: "Chocas los 5 con un amigo. Ejemplo !choquelos5 <name>" },
            { name: '!rolplay', value: "Creas tu personaje aleatorio para rolplay" },
            { name: '!rolnivel', value: "Si tu personaje sube de nivel con este comando sabras que att subirle" },
            { name: '!consulta', value: "Podes preguntarle lo que sea al chat gpt" },
        ];

        let commands_admins = [
            { name: '!setwelcome', value: "Establece sobre el rol que se les da a los que llegan al servidor Ejemplo: !setwelcome @Miembros" },
            { name: '!setfollowing', value: "Establece que canal van a seguir, poniendole un rol donde se puede anunciar, Ejemplo: !setfollowing [canal objetivo a colocar boton] [canal del cual va a ser seguido] [rol que se usara en los anuncios]" },
            { name: '!setrules', value: "Es igual que !setfollowing pero con las reglas, Ejemplo: !setrules [canal objetivo a colocar boton] [canal del cual estan las reglas] [rol que acepto las reglas]" },
            { name: '!settickets', value: "Establece los ticket o issues en el servidor, Ejemplo: !settickets [canal objetivo a crear tickets] [canal para gestionar los tickets]" },
        ]

        let arrTemp = comandos_helper;

        if (isMod || isAdmin) {
            commands_admins.map(c => {
                arrTemp.push(c);
            })
        }


        if (msg.content.toLowerCase() === '!comandos' || msg.content.toLowerCase() === '!help') {
            const embed = new EmbedBuilder()
                .setTitle("Lista de Comandos")
                // .setDescription("list of all commands")
                .setColor(Colors.Red)
                .addFields(
                    comandos_helper
                )
            await msg.reply({
                embeds: [embed]
            });
        }
    }

    //Role Play
    #SubirNivel = () => {
        let maxLevel = 10;
        return {
            fuerza: Math.floor(Math.random() * maxLevel),
            destreza: Math.floor(Math.random() * maxLevel),
            constitucion: Math.floor(Math.random() * maxLevel),
            inteligencia: Math.floor(Math.random() * maxLevel),
            sabiduria: Math.floor(Math.random() * maxLevel),
            carisma: Math.floor(Math.random() * maxLevel),
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

    async Miedo(client, msg) {
        try {
            let perseguir = Math.floor(Math.random() * 16);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/miedo/${perseguir}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = this.#ColorRandom(Colors);

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
            let perseguir = Math.floor(Math.random() * 14);
            if (perseguir == 0) {
                perseguir = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/asustar/${perseguir}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = msg.content.split('<@')[1].split('>')[0];
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

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

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            const embed = new EmbedBuilder()
                .setTitle(`${memberName} ha nalgueado a ${reciverName}`)
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
            let llorar = Math.floor(Math.random() * 14);
            if (llorar == 0) {
                llorar = 1;
            }
            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/llorar/${llorar < 10 ? "0" + llorar : llorar}.gif`;

            // console.log(llorar);

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = this.#ColorRandom(Colors);

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

    async Saludar(client, msg) {
        try {
            let saludar = Math.floor(Math.random() * 22);

            if (saludar == 0) {
                saludar = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = this.#ColorRandom(Colors);

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

            let color = this.#ColorRandom(Colors);

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


    async Pensar(client, msg) {
        try {
            let pensar = Math.floor(Math.random() * 28);

            if (pensar == 0) {
                pensar = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = `${memberName} esta pensando`;

            let folder = "pensar"

            if (msg.content.includes('<@')) {
                pensar = Math.floor(Math.random() * 15);

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

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;

            let str = ``;

            let folder = "FelizCumple"

            if (msg.content.includes('<@')) {

                let reciverID = msg.content.split('<@')[1].split('>')[0];
                let reciver = await guild.members.fetch(reciverID);
                let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

                let atrasado = "";

                if(msg.content.includes("--")){
                    if(msg.content.split("--")[1].trim().toLowerCase().includes("atrasado")){
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
            let chocar5 = Math.floor(Math.random() * 9);

            if (chocar5 == 0) {
                chocar5 = 1;
            }

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let color = this.#ColorRandom(Colors);

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

    async Pareja(client, msg) {
        try {
            let memberOne = await this.#PersonaRandom(client, msg);
            // console.log(memberOne)

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


            let count = seccion == "abrazo" ? 7
                :
                seccion == "besar" ?
                    9 : 4;

            let actionCount = Math.floor(Math.random() * count);
            if (actionCount == 0) {
                actionCount = 1;
            }

            let dir = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${seccion}/${actionCount}.gif`;

            const guild = await client.guilds.cache.get(msg.guild.id);
            let member = await guild.members.fetch(msg.author.id);

            let reciverID = memberOne.user.id;
            let reciver = await guild.members.fetch(reciverID);

            let color = this.#ColorRandom(Colors);

            let memberName = (member.nickname == null) ? msg.author.globalName : member.nickname;
            let reciverName = (reciver.nickname == null) ? reciver.user.globalName : reciver.nickname;

            if (reciverName == "null" || reciverName == null) {
                return this.Pareja(client, msg, EmbedBuilder, Colors);
            }

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
            await msg.reply("Necesitas etiquetar a un amigo o usuario del servidor");
        }
    }

}
module.exports = LibsCommands;