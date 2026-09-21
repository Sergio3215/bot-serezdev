const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { ConsultingOpenAI, createCharacter } = require('./openaiScript.js');
const { commands, checkServer } = require('./commands/index.js');
const { Server, SettingWelcome, ContadorCommand, WelcomeCard } = require('./db/index.js');
const { WelcomeCardRenderer } = require('./commands/util/welcomeCard.js');
const { ManageInteraction } = require('./interaction/index.js');
const { SlashCommands } = require('./slash command/index.js');
const { SlashLib } = require('./slash command/lib.js');
const { LibAutocomplete } = require('./slash command/lib-autocomplete.js');
const { RUNTIME_BOT } = require('./library/index.js');

const { CronJob } = require('cron');

require('dotenv').config();
const token = process.env.token;

const library = new RUNTIME_BOT();


const ServerDb = new Server();
const settingWelcome = new SettingWelcome();
const counterDb = new ContadorCommand();
const welcomeCardDb = new WelcomeCard();
const welcomeCard = new WelcomeCardRenderer();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution
    ]
});

//Send the message
async function sendMessage() {
    const count = await counterDb.Get();
    count.map(async co => {
        const lastDay = Math.floor((new Date() - co.modifiedOn) / (1000 * 60 * 60 * 24));

        if (lastDay >= 30) {
            const updateData = {
                channelId: co.channelId,
                modifiedBy: '',
                count: 0,
            };
            await contador_command.Update(co.serverId, updateData);

            await msg.channel.send("Se ha terminado la racha del contador por inactividad de 30 dias.");
        }
    });
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    SlashCommands(client);

    let dayMillseconds = 3600000 * 24;
    setInterval(function () {
        sendMessage();
    }, dayMillseconds);

    const cron = new CronJob('0 0 0 * * *',
        () => {
            console.log('Start runtime');
            library.birthday_runtime(client);
        },
        null,
        true,
        'America/Argentina/Buenos_Aires');

    // Sincroniza los gifs de todos los servidores 3 veces al dia: 08:00, 14:00 y 21:00
    const cronGifs = new CronJob('0 0 8,14,21 * * *',
        () => {
            console.log('Start sync gifs');
            library.gif_runtime(client);
        },
        null,
        true,
        'America/Argentina/Buenos_Aires');

});

client.on('messageCreate', async (msg) => {
    console.log(`Message received: ${msg.content} from ${msg.guild.name}`);
    try {
        checkServer(msg.guild);
        let admin = false;
        let isMod = false;
        if (msg != null) {
            admin = msg.member.permissions.has(PermissionsBitField.Flags.Administrator);
            isMod = msg.member.permissions.has(
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ManageChannels
            );
        }
        commands(client, msg, ConsultingOpenAI, admin, isMod, userIsSubOrBooster, createCharacter);
    } catch (error) {

    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        let admin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator),
            isMod = interaction.member.permissions.has(
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ManageChannels
            );
        // console.log('Comando de barra invocado:', interaction.commandName);
        // console.log('Comando invocado:', interaction.isChatInputCommand());
        if (interaction.isChatInputCommand() ||
            interaction.isUserContextMenuCommand() ||
            interaction.isMessageContextMenuCommand()) {
            console.log('Comando chat  invocado:', interaction.isChatInputCommand());
            try {
                await SlashLib(client, isMod, admin, interaction);
            } catch (error) {
                console.error('Error al ejecutar el comando de barra:', error);
            }
        }

        // Los modales entran por acá. Sin esta rama, el formulario de ticket se envía y
        // no lo recibe nadie: era lo que rompía crear y cerrar tickets.
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            await ManageInteraction(client, interaction);
        }

        if (interaction.isAutocomplete()) {
            await LibAutocomplete(client, interaction, isMod, admin);
        }

    } catch (error) {
        console.error('Error al manejar la interacción:', error);
    }
});


// Cuando agregan el bot a un servidor nuevo, sincroniza sus gifs al toque
client.on('guildCreate', async (guild) => {
    console.log(`Bot agregado al servidor: ${guild.name} (${guild.id})`);
    library.gif_runtime_server(guild.id);
});


client.on('guildMemberAdd', async (member) => {

    // 1. Rol automático de bienvenida
    try {
        const settingWelcomeData = await settingWelcome.GetById(member.guild.id);
        if (settingWelcomeData.length > 0) {
            const roleId = settingWelcomeData[0].setRole;
            await member.roles.add(roleId);
        }
    } catch (error) {
        console.log('[guildMemberAdd] no se pudo asignar el rol:', error.message);
    }

    // 2. Imagen de bienvenida. Va en su propio try: si falla el dibujo o el envío,
    //    el rol de arriba ya quedó asignado igual.
    try {
        const card = await welcomeCardDb.GetOne(member.guild.id);

        if (!card || !card.enabled || !card.channelId) return;

        const channel = await member.guild.channels.fetch(card.channelId);
        if (!channel) return;

        await channel.send(await welcomeCard.BuildMessage(card, member));
    } catch (error) {
        console.log('[guildMemberAdd] no se pudo enviar la bienvenida:', error.message);
    }
});

async function userIsSubOrBooster(member) {
    // 1. Server booster (rol con .tags.premium_subscriber === true)
    const isBooster = member.roles.cache.some(role => role.tags?.premium_subscriber);

    // 2. Twitch sub: busca rol que empiece con "Twitch Subscriber:" o "Suscriptor de Twitch:"
    const isTwitchSub = member.roles.cache.some(role =>
        role.name.startsWith("Twitch Subscriber:") ||
        role.name.startsWith("Suscriptor de Twitch:")
    );

    return isBooster || isTwitchSub;
}

client.login(token);
