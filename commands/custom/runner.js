const {
    GetCustomCommandFromMap,
    IsCustomCommandCacheReady,
} = require("./index.js");
const {
    Execute,
    NativeRegistry,
} = require("./language/index.js");

const RunCustomCommandInternal = async (client, msg) => {
    if (
        !IsCustomCommandCacheReady()
        || !msg?.guild?.id
        || typeof msg.content !== "string"
        || msg.author?.id === client?.user?.id
    ) {
        return false;
    }

    const compiledCommand = GetCustomCommandFromMap(msg.guild.id, msg.content);
    if (compiledCommand === null) {
        return false;
    }

    const result = await Execute(
        compiledCommand.program.instructions,
        {
            client,
            guild: msg.guild,
            channel: msg.channel,
            sourceMessage: msg,
            nativeRegistry: NativeRegistry,
        },
    );

    if (!result.ok) {
        console.error(
            `Custom command execution failed: ${compiledCommand.id}`,
            result.diagnostics,
        );
    }

    return true;
};

const RunCustomCommand = async (client, msg) => {
    try {
        return await RunCustomCommandInternal(client, msg);
    } catch (error) {
        console.error("Unexpected custom command runner error:", error);
        return false;
    }
};

module.exports = {
    RunCustomCommand,
};
