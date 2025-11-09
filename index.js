const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { ConsultingOpenAI, createCharacter } = require('./openaiScript.js');
const { commands, checkServer } = require('./commands/index.js');
const { Server, SettingWelcome, ContadorCommand } = require('./db/index.js');
const { ManageInteraction } = require('./interaction/index.js');
const { SlashCommands } = require('./slash command/index.js');
const { SlashLib } = require('./slash command/lib.js');
const { LibAutocomplete } = require('./slash command/lib-autocomplete.js');
require('dotenv').config();
const token = process.env.token;


const ServerDb = new Server();
const settingWelcome = new SettingWelcome();
const counterDb = new ContadorCommand();

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

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    SlashCommands(client);

    let dayMillseconds = 3600000 * 24;
    setInterval(function () {
        sendMessage();
    }, dayMillseconds);
});

client.on('messageCreate', async (msg) => {
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
                SlashLib(client, isMod, admin, interaction);
            } catch (error) {
                console.error('Error al ejecutar el comando de barra:', error);
            }
        }

        if (interaction.isButton() || interaction.isSelectMenu()) {
            ManageInteraction(client, interaction);
        }

        if (interaction.isAutocomplete()) {
            LibAutocomplete(client, interaction, isMod, admin);
        }

    } catch (error) {
        console.error('Error al manejar la interacción:', error);
    }
});


client.on('guildMemberAdd', async (member) => {

    try {
        const settingWelcomeData = await settingWelcome.GetById(member.guild.id);
        if (settingWelcomeData.length > 0) {
            const roleId = settingWelcomeData[0].setRole;
            member.roles.add(roleId);
        }
    } catch (error) {

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
