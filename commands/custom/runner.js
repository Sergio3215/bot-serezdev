const {
    GetCustomCommandFromMap,
    IsCustomCommandCacheReady,
} = require("./index.js");
const {
    Execute,
    Native,
    NativeImplementations,
    NativeRegistry,
} = require("./language/index.js");

const MissingMentionMessage = "Tenés que mencionar a alguien para usar este comando.";

const NormalizeAllowedRoleIds = (allowedRoleIds) => (
    Array.isArray(allowedRoleIds)
        ? [...new Set(allowedRoleIds.filter(
            (roleId) => typeof roleId === "string" && roleId.length > 0,
        ))]
        : []
);

const ResolveMessageAuthorMember = async (msg) => {
    const authorId = msg?.author?.id;

    if (!authorId || !msg?.guild?.members) {
        return null;
    }

    if (msg.member?.id === authorId) {
        return msg.member;
    }

    const cachedMember = msg.guild.members.cache?.get(authorId);
    if (cachedMember) {
        return cachedMember;
    }

    try {
        return await msg.guild.members.fetch(authorId);
    } catch {
        return null;
    }
};

const PrepareRequiredContext = async (compiledCommand, runtimeContext) => {
    const requirements = compiledCommand?.program?.requirements ?? [];

    if (!requirements.includes(Native.NativeRequirement.MENTION)) {
        return {
            ok: true,
            runtimeContext,
        };
    }

    const mentionContext = await NativeImplementations.ResolveMentionContext(runtimeContext);
    if (mentionContext.mentionedMembers.length === 0) {
        return {
            ok: false,
            error: "MISSING_MENTION",
            runtimeContext,
        };
    }

    return {
        ok: true,
        runtimeContext: {
            ...runtimeContext,
            mentionContext,
        },
    };
};

const HasCustomCommandPermission = (msg, compiledCommand, authorMember) => {
    const allowedRoleIds = NormalizeAllowedRoleIds(compiledCommand?.allowedRoleIds);
    if (allowedRoleIds.length === 0) return true;

    const guildRoles = msg?.guild?.roles?.cache;
    if (!guildRoles || typeof guildRoles.has !== "function") return false;

    const effectiveRoleIds = allowedRoleIds.filter((roleId) => guildRoles.has(roleId));
    if (effectiveRoleIds.length === 0) return true;

    const memberRoles = authorMember?.roles?.cache;
    if (!memberRoles || typeof memberRoles.has !== "function") return false;

    return effectiveRoleIds.some((roleId) => memberRoles.has(roleId));
};

const ExecuteCompiledCustomCommand = async (
    client,
    msg,
    compiledCommand,
    resolvedAuthorMember = null,
) => {
    const authorMember = resolvedAuthorMember ?? await ResolveMessageAuthorMember(msg);
    if (authorMember === null) {
        return false;
    }

    const prepared = await PrepareRequiredContext(compiledCommand, {
        client,
        guild: msg.guild,
        channel: msg.channel,
        sourceMessage: msg,
        authorMember,
        nativeRegistry: NativeRegistry,
    });

    if (!prepared.ok && prepared.error === "MISSING_MENTION") {
        await msg.reply({ content: MissingMentionMessage });
        return true;
    }

    const result = await Execute(
        compiledCommand.program.instructions,
        prepared.runtimeContext,
    );

    if (!result.ok) {
        console.error(
            `Custom command execution failed: ${compiledCommand.id}`,
            result.diagnostics,
        );
    }

    return true;
};

const RunCustomCommandInternal = async (client, msg) => {
    if (
        !IsCustomCommandCacheReady()
        || !msg?.guild?.id
        || typeof msg.content !== "string"
        || msg.author?.bot === true
        || msg.webhookId != null
    ) {
        return false;
    }

    const compiledCommand = GetCustomCommandFromMap(msg.guild.id, msg.content);
    if (compiledCommand === null) {
        return false;
    }

    const authorMember = await ResolveMessageAuthorMember(msg);
    if (authorMember === null) return false;

    if (!HasCustomCommandPermission(msg, compiledCommand, authorMember)) {
        return false;
    }

    return ExecuteCompiledCustomCommand(client, msg, compiledCommand, authorMember);
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
    RunCustomCommandInternal,
    ResolveMessageAuthorMember,
    HasCustomCommandPermission,
    NormalizeAllowedRoleIds,
    PrepareRequiredContext,
    ExecuteCompiledCustomCommand,
    MissingMentionMessage,
};
