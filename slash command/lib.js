const { setMetric } = require("../commands");
const LibsCommands = require("../commands/lib");

let libCommands = new LibsCommands();

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
        else{
            await interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });
        }
    }
}

module.exports = { SlashLib };