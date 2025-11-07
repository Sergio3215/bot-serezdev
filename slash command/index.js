const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const LibsCommands = require('../commands/lib');

function SlashCommands(client) {
    const lib = new LibsCommands();

    const commands = [
        {
            data: new SlashCommandBuilder()
                .setName('ping')
                .setDescription('Responde pong!')
        },
        {
            data: new SlashCommandBuilder()
                .setName('server')
                .setDescription('Información del servidor.')
        },
        {
            data: new SlashCommandBuilder()
                .setName('comandos')
                .setDescription('Muestra los comandos disponibles.')
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.token);

    (async () => {
        try {
            console.log('🔁 Registrando comandos...');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands.map(command => command.data.toJSON()) },
            );
            console.log('✅ Comandos registrados correctamente.');
        } catch (error) {
            console.error(error);
        }
    })();
}

module.exports = { SlashCommands };