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
        else {
            await interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });
        }
    }
    if (interaction.commandName == 'setup-birthday') {
        if (isAdmin || isMod) {
            libCommands.SetupBirthdays(client, interaction);
            setMetric("!setup-birthday", interaction);
        }
        else {
            await interaction.reply({ content: 'No tienes permisos para usar este comando.', ephemeral: true });
        }
    }
    if (interaction.commandName == 'birthday') {
        libCommands.BirthdayLib(client, interaction);
        setMetric("!birthday", interaction);
    }

    if (interaction.commandName == 'cumpleaños') {
        libCommands.CumpleañosLib(client, interaction);
        setMetric("!cumpleaños", interaction);
    }
    if (interaction.commandName == 'restart') {
        if (interaction.user.id === '276513065464365066') {
            libCommands.RestartBot(client, interaction);
            setMetric("!restart", interaction);
        }
        else {
            return;
        }
    }
}



module.exports = { SlashLib };