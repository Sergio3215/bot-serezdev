const { CustomCommand } = require('../../db/index.js');
const {
    CompileCustomCommand,
    NativeRegistry: defaultNativeRegistry,
} = require('./language/index.js');
const { DeepFreeze } = require('./language/native/types.js');

const customCommandDb = new CustomCommand();

let cacheState = Object.freeze({
    ready: false,
    loadedAt: null,
    commands: new Map(),
    summary: null,
});

const AddCompiledCommand = (commandsMap, compiledCommand) => {
    let serverCommands = commandsMap.get(compiledCommand.serverId);

    if (!serverCommands) {
        serverCommands = new Map();
        commandsMap.set(compiledCommand.serverId, serverCommands);
    }

    serverCommands.set(compiledCommand.command, compiledCommand);
};

const LoadCustomCommandMap = async (nativeRegistry = defaultNativeRegistry) => {
    const commands = await customCommandDb.GetEnabled();
    const temporaryCommands = new Map();
    const diagnostics = [];
    let loaded = 0;

    for (const command of commands) {
        const compilation = CompileCustomCommand(command, nativeRegistry);

        if (!compilation.ok) {
            diagnostics.push({
                commandId: command.id,
                errors: compilation.diagnostics,
            });
            continue;
        }

        AddCompiledCommand(temporaryCommands, compilation.value.compiledCommand);
        loaded += 1;
    }

    const summary = DeepFreeze({
        found: commands.length,
        loaded,
        failed: commands.length - loaded,
        diagnostics,
    });

    cacheState = Object.freeze({
        ready: true,
        loadedAt: new Date(),
        commands: temporaryCommands,
        summary,
    });

    return summary;
};

const FindCustomCommandInServerMap = (serverCommands, messageContent) => {
    if (!(serverCommands instanceof Map) || typeof messageContent !== "string") {
        return null;
    }

    let match = null;
    let matchPriority = -1;
    let matchLength = -1;
    let matchId = null;

    const priorities = {
        exact: 3,
        startsWith: 2,
        endsWith: 2,
        include: 1,
    };

    for (const [command, compiledCommand] of serverCommands) {
        const commandValue = typeof compiledCommand?.command === "string"
            ? compiledCommand.command
            : command;
        const triggerType = Object.hasOwn(priorities, compiledCommand?.triggerType)
            ? compiledCommand.triggerType
            : "include";

        if (typeof commandValue !== "string") continue;

        const matches = (
            (triggerType === "exact" && messageContent === commandValue)
            || (triggerType === "startsWith" && messageContent.startsWith(commandValue))
            || (triggerType === "endsWith" && messageContent.endsWith(commandValue))
            || (triggerType === "include" && messageContent.includes(commandValue))
        );

        if (!matches) continue;

        const priority = priorities[triggerType];
        const candidateId = String(compiledCommand?.id ?? commandValue);
        const winsTie = (
            priority === matchPriority
            && commandValue.length === matchLength
            && (matchId === null || candidateId < matchId)
        );

        if (
            priority > matchPriority
            || (priority === matchPriority && commandValue.length > matchLength)
            || winsTie
        ) {
            match = compiledCommand;
            matchPriority = priority;
            matchLength = commandValue.length;
            matchId = candidateId;
        }
    }

    return match;
};

const GetCustomCommandFromMap = (serverId, messageContent) => {
    if (!cacheState.ready) {
        return null;
    }

    return FindCustomCommandInServerMap(
        cacheState.commands.get(serverId),
        messageContent,
    );
};

const IsCustomCommandCacheReady = () => cacheState.ready;

const GetCustomCommandCacheSummary = () => cacheState.summary;

module.exports = {
    LoadCustomCommandMap,
    FindCustomCommandInServerMap,
    GetCustomCommandFromMap,
    IsCustomCommandCacheReady,
    GetCustomCommandCacheSummary,
};
