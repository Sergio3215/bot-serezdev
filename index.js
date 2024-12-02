const { Client, GatewayIntentBits } = require('discord.js');
const { Consulting } = require('./gemini');
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
                msg.delete();
                msg.channel.send("Comando No Valido, o Canal Incorrecto");
            }
        }
    } catch (error) {
        console.log(error.message);
        msg.reply('No entendi tu pedido');
    }
});


client.on('guildMemberAdd', async (member) => {
    if (member.guild.id == '1235045954491781150') {
        member.roles.add('1235247138787823646');
    }
});


client.login(token);
