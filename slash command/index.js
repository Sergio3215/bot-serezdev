const { SlashCommandBuilder, REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

function SlashCommands(client) {

    const commands = [
        //------- CONTEXT SLASH COMMANDS -------
        {
            data: new SlashCommandBuilder()
                .setName('server')
                .setDescription('Información del servidor.')
        },
        {
            data: new SlashCommandBuilder()
                .setName('comandos')
                .setDescription('Muestra los comandos disponibles.')
        },
        {
            data: new SlashCommandBuilder()
                .setName('contador')
                .setDescription('Establece el contador para un canal específico. Y a disfrutar!')
                .addStringOption(opt => {
                    return opt.setName('canal')
                        .setDescription('Canal donde se establecerá el contador')
                        .setRequired(true)
                        .setAutocomplete(true);
                }),
        },

        // ---- CONTEXT MENU: USER (aparece en Apps al click derecho sobre un usuario)
        {
            data: new ContextMenuCommandBuilder()
                .setName('comandos')
                .setType(ApplicationCommandType.User),
            async execute(i) {
                const user = i.targetUser;
                await i.reply({ content: user.displayAvatarURL({ size: 512 }), ephemeral: true });
            }
        },

        // ---- CONTEXT MENU: MESSAGE (aparece en Apps al click derecho sobre un mensaje)
        {
            data: new ContextMenuCommandBuilder()
                .setName('comandos')
                .setType(ApplicationCommandType.Message)
        },
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