const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { commands, checkServer } = require('./commands/index.js');
const { Server, SettingWelcome } = require('./db/index.js');
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
    commands(msg, Consulting, admin, isMod);
});


client.on('guildMemberAdd', async (member) => {
    // const dataServer = (await ServerDb.GetById(member.guild.id))
    // if (member.guild.id == '1235045954491781150') {
    //     member.roles.add('1235247138787823646');
    // }

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
