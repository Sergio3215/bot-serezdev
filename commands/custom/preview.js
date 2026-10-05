const {
    CompileCustomCommand,
    Execute,
} = require("./language/index.js");
const {
    PrepareRequiredContext,
    MissingMentionMessage,
} = require("./runner.js");

const PREVIEW_MESSAGE_MAX_LENGTH = 2000;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const USER_MENTION_PATTERN = /<@!?(\d{17,20})>/g;

const PreviewIds = Object.freeze({
    author: "100000000000000001",
    channel: "100000000000000002",
    mention: "100000000000000003",
});

const PreviewDefaults = Object.freeze({
    authorUsername: "usuario_de_prueba",
    authorDisplayName: "Usuario de prueba",
    channelName: "canal-de-prueba",
    mentionDisplayName: "Miembro mencionado",
    memberCount: 100,
});

const ToHexColor = (color) => (
    Number.isInteger(color)
        ? `#${color.toString(16).padStart(6, "0").toUpperCase()}`
        : null
);

const ToEmbedPreview = (embed) => {
    const data = typeof embed?.toJSON === "function" ? embed.toJSON() : embed ?? {};

    return {
        title: data.title ?? null,
        description: data.description ?? null,
        color: ToHexColor(data.color),
        url: data.url ?? null,
        image: data.image?.url ?? null,
        author: data.author
            ? {
                name: data.author.name,
                icon: data.author.icon_url ?? null,
                url: data.author.url ?? null,
            }
            : null,
        footer: data.footer
            ? {
                text: data.footer.text,
                icon: data.footer.icon_url ?? null,
            }
            : null,
    };
};

const ToMessageAction = (kind, payload, channelId) => {
    const isEmbed = Array.isArray(payload?.embeds) && payload.embeds.length > 0;
    const type = `${kind}${isEmbed ? "Embed" : "Message"}`;

    return {
        type,
        ...(kind === "Send" ? { channelId } : {}),
        message: typeof payload?.content === "string" ? payload.content : null,
        ...(isEmbed ? { embed: ToEmbedPreview(payload.embeds[0]) } : {}),
    };
};

const CreatePreviewMember = (actions, { id, username, displayName }) => ({
    id,
    displayName,
    user: Object.freeze({ id, username, bot: false }),
    roles: {
        cache: new Map(),
        async add(role) {
            actions.push({
                type: "AddRole",
                memberId: id,
                memberName: displayName,
                roleId: role.id,
            });
        },
    },
});

const CreatePreviewChannel = (actions, id, name = null) => ({
    id,
    name,
    isTextBased: () => true,
    async send(payload) {
        actions.push(ToMessageAction("Send", payload, id));
    },
});

const GetMentionedIds = (content) => {
    const ids = [];
    USER_MENTION_PATTERN.lastIndex = 0;
    let match;

    while ((match = USER_MENTION_PATTERN.exec(content)) !== null) {
        if (!ids.includes(match[1])) ids.push(match[1]);
    }

    return ids;
};

const CreatePreviewContext = ({ serverId, message, nativeServices }) => {
    const actions = [];
    const author = CreatePreviewMember(actions, {
        id: PreviewIds.author,
        username: PreviewDefaults.authorUsername,
        displayName: PreviewDefaults.authorDisplayName,
    });
    const channel = CreatePreviewChannel(actions, PreviewIds.channel, PreviewDefaults.channelName);

    const members = new Map([[author.id, author]]);
    const ResolveMember = (id) => {
        if (!members.has(id)) {
            members.set(id, CreatePreviewMember(actions, {
                id,
                username: `miembro_${id.slice(-4)}`,
                displayName: id === PreviewIds.mention
                    ? PreviewDefaults.mentionDisplayName
                    : `Miembro simulado ${id.slice(-4)}`,
            }));
        }

        return members.get(id);
    };

    const mentionedIds = GetMentionedIds(message);
    for (const id of mentionedIds) ResolveMember(id);

    const channels = new Map([[channel.id, channel]]);
    const guild = {
        id: serverId,
        memberCount: PreviewDefaults.memberCount,
        members: {
            cache: members,
            fetch: async (id) => (SNOWFLAKE_PATTERN.test(id) ? ResolveMember(id) : null),
        },
        roles: {
            cache: new Map(),
            fetch: async (id) => (SNOWFLAKE_PATTERN.test(id) ? { id } : null),
        },
        channels: {
            cache: channels,
            fetch: async (id) => {
                if (!SNOWFLAKE_PATTERN.test(id)) return null;
                if (!channels.has(id)) channels.set(id, CreatePreviewChannel(actions, id));
                return channels.get(id);
            },
        },
    };

    const sourceMessage = {
        content: message,
        author: author.user,
        channel,
        async reply(payload) {
            actions.push(ToMessageAction("Reply", payload));
        },
    };

    const summary = {
        message,
        serverId,
        memberCount: PreviewDefaults.memberCount,
        author: {
            id: author.id,
            username: author.user.username,
            displayName: author.displayName,
        },
        channel: {
            id: channel.id,
            name: channel.name,
        },
        mentionedMembers: mentionedIds.map((id) => ({
            id,
            displayName: members.get(id).displayName,
        })),
    };

    return {
        actions,
        summary,
        runtimeContext: {
            guild,
            channel,
            sourceMessage,
            authorMember: author,
            ...(nativeServices ? { nativeServices } : {}),
        },
    };
};

const ToPreviewDiagnostic = (diagnostic) => ({
    phase: diagnostic.phase,
    code: diagnostic.code,
    message: diagnostic.message,
    line: diagnostic.loc?.start?.line ?? null,
    column: diagnostic.loc?.start?.column ?? null,
});

const ValidatePreviewInput = ({ serverId, code, message }) => {
    if (typeof serverId !== "string" || !SNOWFLAKE_PATTERN.test(serverId)) {
        return { error: "El id del servidor es requerido" };
    }

    if (typeof code !== "string" || code.trim().length === 0) {
        return { error: "El código embebido es requerido" };
    }

    if (message !== undefined && typeof message !== "string") {
        return { error: "El mensaje de prueba debe ser texto" };
    }

    if (typeof message === "string" && message.length > PREVIEW_MESSAGE_MAX_LENGTH) {
        return {
            error: `El mensaje de prueba no puede superar los ${PREVIEW_MESSAGE_MAX_LENGTH} caracteres`,
        };
    }

    return { value: null };
};

const BuildPreviewMessage = (message, simulateMention) => {
    const content = typeof message === "string" ? message : "";
    if (!simulateMention || GetMentionedIds(content).length > 0) return content;
    return `${content}${content.length > 0 ? " " : ""}<@${PreviewIds.mention}>`;
};

const PreviewCustomCommand = async (
    { serverId, code, message, mention },
    { nativeServices } = {},
) => {
    const compilation = CompileCustomCommand({
        id: "preview",
        serverId,
        command: "preview",
        triggerType: "include",
        allowedRoleIds: [],
        code,
    });

    const context = CreatePreviewContext({
        serverId,
        message: BuildPreviewMessage(message, mention === true),
        nativeServices,
    });

    if (!compilation.ok) {
        return {
            ok: false,
            stage: "compile",
            diagnostics: compilation.diagnostics.map(ToPreviewDiagnostic),
            actions: [],
            context: context.summary,
        };
    }

    const { program } = compilation.value.compiledCommand;
    const prepared = await PrepareRequiredContext(
        compilation.value.compiledCommand,
        context.runtimeContext,
    );

    if (!prepared.ok) {
        return {
            ok: false,
            stage: "runtime",
            diagnostics: [{
                phase: "runtime",
                code: prepared.error,
                message: MissingMentionMessage,
                line: null,
                column: null,
            }],
            actions: [{ type: "ReplyMessage", message: MissingMentionMessage }],
            context: context.summary,
        };
    }

    const result = await Execute(program.instructions, prepared.runtimeContext);

    return {
        ok: result.ok,
        stage: result.ok ? null : "runtime",
        diagnostics: result.diagnostics.map(ToPreviewDiagnostic),
        actions: context.actions,
        context: context.summary,
    };
};

module.exports = {
    PreviewCustomCommand,
    ValidatePreviewInput,
    PreviewIds,
    PreviewDefaults,
    PREVIEW_MESSAGE_MAX_LENGTH,
};
