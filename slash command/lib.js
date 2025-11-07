const { setMetric } = require("../commands");
const LibsCommands = require("../commands/lib");

let libCommands = new LibsCommands();

async function SlashLib(client, isMod, isAdmin, interaction){

    console.log('Comando de barra invocado:', interaction.commandName);
    if(interaction.commandName === 'ping'){
        await interaction.reply('Pong!');
    }
    if(interaction.commandName === 'server'){
        await interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
    }

    if(interaction.commandName === 'comandos'){
        libCommands.Comandos(isMod, isAdmin, interaction);
        setMetric("!comandos", interaction);
    }
}

module.exports = { SlashLib };