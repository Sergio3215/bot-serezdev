const { Server, SettingWelcome, buttonFollowing } = require("../db/index.js");
const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const settingWelcome = new SettingWelcome();
const btnfollow = new buttonFollowing();

class LibsCommands {

    constructor() {

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

}
module.exports = LibsCommands;