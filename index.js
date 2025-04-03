const { Client, GatewayIntentBits } = require('discord.js');
const { Consulting } = require('./gemini');
const { commands } = require('./commands/index.js');
require('dotenv').config();
const token = process.env.token;


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
    commands(msg, Consulting);
});


client.on('guildMemberAdd', async (member) => {
    if (member.guild.id == '1235045954491781150') {
        member.roles.add('1235247138787823646');
    }
});


client.login(token);
