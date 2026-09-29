const { CustomCommand } = require('../../db/index.js');

const customCommandDb = new CustomCommand();

// Cada servidor tiene su propio mapa de comandos.
// Map<serverId, Map<command, CustomCommand>>
const customCommandMap = new Map();

const FillCustomCommandMap = (commands) => {
    customCommandMap.clear();

    for (const command of commands) {
        let serverCommands = customCommandMap.get(command.serverId);

        if (!serverCommands) {
            serverCommands = new Map();
            customCommandMap.set(command.serverId, serverCommands);
        }

        serverCommands.set(command.command, command);
    }

    return commands.length;
};

const LoadCustomCommandMap = async () => {
    const commands = await customCommandDb.GetEnabled();
    return FillCustomCommandMap(commands);
};

const GetCustomCommandFromMap = (serverId, command) => {
    return customCommandMap.get(serverId)?.get(command) ?? null;
};

module.exports = {
    customCommandMap,
    FillCustomCommandMap,
    LoadCustomCommandMap,
    GetCustomCommandFromMap,
};
