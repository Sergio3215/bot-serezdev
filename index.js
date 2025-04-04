const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { commands, checkServer } = require('./commands/index.js');
const { Server, SettingWelcome } = require('./db/index.js');
const { ManageInteraction } = require('./interaction/index.js');
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
        commands(client, msg, Consulting, admin, isMod);
    } catch (error) {

    }
});

client.on('interactionCreate', async (interaction) => {
    ManageInteraction(interaction);
});


client.on('guildMemberAdd', async (member) => {

    try {
        const settingWelcomeData = await settingWelcome.GetById(member.guild.id);
        if (settingWelcomeData.length > 0) {
            const roleId = settingWelcomeData[0].roleId;
            member.roles.add(roleId);
        }
    } catch (error) {

    }
});


client.login(token);
