const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { ConsultingOpenAI, createCharacter } = require('./openaiScript.js');
const { commands, checkServer } = require('./commands/index.js');
const { Server, SettingWelcome } = require('./db/index.js');
const { ManageInteraction } = require('./interaction/index.js');
const { SlashCommands } = require('./slash command/index.js');
const { SlashLib } = require('./slash command/lib.js');
require('dotenv').config();
const token = process.env.token;


const ServerDb = new Server();
const settingWelcome = new SettingWelcome();

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

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    SlashCommands(client);
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
    // console.log('Comando de barra invocado:', interaction.commandName);
    // console.log('Comando invocado:', interaction.isChatInputCommand());
    if (interaction.isChatInputCommand() ||
        interaction.isUserContextMenuCommand() ||
        interaction.isMessageContextMenuCommand()) {
        try {
            let admin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator),
                isMod = interaction.member.permissions.has(
                    PermissionsBitField.Flags.KickMembers,
                    PermissionsBitField.Flags.BanMembers,
                    PermissionsBitField.Flags.ManageMessages,
                    PermissionsBitField.Flags.ManageChannels
                );
            SlashLib(client, isMod, admin, interaction);
        } catch (error) {
            console.error('Error al ejecutar el comando de barra:', error);
        }
    }
    else {
        ManageInteraction(client, interaction);
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
