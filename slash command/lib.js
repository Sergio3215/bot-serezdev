const { setMetric } = require("../commands");
const LibsCommands = require("../commands/lib");
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { BirthdaySetup, Birthday } = require("../db");

let libCommands = new LibsCommands();

let birthday_setup = new BirthdaySetup();
let birthday = new Birthday();

async function SlashLib(client, isMod, isAdmin, interaction) {

    // console.log('Comando de barra invocado:', interaction.commandName);
    if (interaction.commandName === 'server') {
        await interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
    }

    if (interaction.commandName === 'comandos') {
        libCommands.Comandos(isMod, isAdmin, interaction);
        setMetric("!comandos", interaction);
    }

    if (interaction.commandName === 'contador') {
        if (isAdmin || isMod) {
            libCommands.ContadorCommand(client, interaction);
            setMetric("!contador", interaction);
        }
        else {
            await interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });
        }
    }
    if (interaction.commandName == 'setup-birthday') {
        if (isAdmin || isMod) {
            SetupBirthdays(client, interaction);
            setMetric("!setup-birthday", interaction);
        }
        else {
            await interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });
        }
    }
    if (interaction.commandName == 'birthday') {
        BirthdayLib(client, interaction);
        setMetric("!birthday", interaction);
    }
}

const BirthdayLib = async (client, interaction) => {
    const day = interaction.options.getString('dia');
    const month = interaction.options.getString('mes');
    const age = interaction.options.getString('edad');
    const user = interaction.user;

    try {
        const bd = await birthday.GetById(interaction.guild.id);

        const usr = bd.filter(usr => usr.userId == user.id)

        if (usr.length == 0) {
            await birthday.Create({
                serverId: interaction.guild.id,
                serverName: interaction.guild.name,
                userId: user.id,
                day: day,
                month: month,
                age: age,
            });

            await interaction.reply({ content: 'Se ha agregado tu cumpleaños.' });
        }
        else {
            await birthday.Update(interaction.guild.id, {
                day: day,
                month: month,
                age: age,
            });

            await interaction.reply({ content: 'Se ha modificado tu cumpleaños.' });
        }

    } catch (error) {
        console.log(error);
        await interaction.reply({ content: 'No se pudo agregar tu cumpleaños.' });
    }
}

const SetupBirthdays = async (client, interaction) => {
    const message = interaction.options.getString('mensaje-personalizado');
    if (message == "" || message == null || message == undefined) {
        message = "$nombre Felicidades por cumplir años🎉, los $edad son bastantes. Que cumplas muchos mas. ¡Pasala muy bonito con tus seres queridos!🎉";
    }

    const guild = interaction.guild;

    try {

        const bd = await birthday_setup.GetById(guild.id);

        if (bd.length > 0) {

            const channel = await interaction.guild.channels.fetch(bd[0].channelId).catch(() => null);

            //crear canal si no existe
            if (!channel) {
                const category = await interaction.guild.channels.create({
                    name: '🎂Feliz Cumpleaños🎂',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.SendMessages],
                        },
                    ],
                    reason: 'Creación de la categoría de cumpleaños',
                });

                const channel = await interaction.guild.channels.create({
                    name: '🎂Mensajes de cumpleaños🎂',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    topic: 'Canal para recibir la felicitación de cumpleaños de los usuarios',
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.SendMessages],
                        },
                    ],
                    reason: 'Creación del canal de cumpleaños',
                });
                await birthday_setup.Update(guild.id, {
                    channelId: channel.id,
                });
            }

            //Si existe el canal solo guardar el mensaje
            await birthday_setup.Update(guild.id, {
                message: message,
            });

            await interaction.reply({ content: `Se ha hecho la configuración correspondiente.` });
        }
        else {

            const category = await interaction.guild.channels.create({
                name: '🎂Feliz Cumpleaños🎂',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.SendMessages],
                    },
                ],
                reason: 'Creación de la categoría de cumpleaños',
            });

            const channel = await interaction.guild.channels.create({
                name: '🎂Mensajes de cumpleaños🎂',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: 'Canal para recibir la felicitación de cumpleaños de los usuarios',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.SendMessages],
                    },
                ],
                reason: 'Creación del canal de cumpleaños',
            });

            birthday_setup.Create({
                serverId: guild.id,
                serverName: guild.name,
                channelId: channel.id,
                message: message,
            });
            await interaction.reply({ content: `Se ha hecho la configuración correspondiente. El canal donde se agasajan los cumpleaños es ${channel.name}` });
        }



    } catch (error) {
        console.log(error);
        await interaction.reply({ content: 'No se pudo crear el canal de cumpleaños.' });
    }


}

module.exports = { SlashLib };