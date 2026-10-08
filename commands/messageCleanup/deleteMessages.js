const {
    PermissionFlagsBits,
    SnowflakeUtil,
} = require("discord.js");

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_MESSAGES = 500;
const MAX_BULK_DELETE_SIZE = 100;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const BULK_DELETE_SAFETY_MS = 60 * 1000;

class MessageCleanupError extends Error {
    constructor(code, message, cause) {
        super(message, cause ? { cause } : undefined);
        this.name = "MessageCleanupError";
        this.code = code;
    }
}

const ResolveCleanupGuild = async (client, serverId) => {
    const cached = client?.guilds?.cache?.get?.(serverId);
    if (cached) return cached;
    if (typeof client?.guilds?.fetch !== "function") return null;
    return await client.guilds.fetch(serverId);
};

const ResolveCleanupChannel = async (guild, channelId) => {
    const cached = guild?.channels?.cache?.get?.(channelId);
    if (cached) return cached;
    if (typeof guild?.channels?.fetch !== "function") return null;
    return await guild.channels.fetch(channelId);
};

const AssertCleanupChannel = (guild, channel, serverId, channelId) => {
    if (!channel || channel.guildId && channel.guildId !== serverId) {
        throw new MessageCleanupError(
            "CHANNEL_NOT_FOUND",
            `No se encontró el canal ${channelId} en el servidor ${serverId}`,
        );
    }
    if (
        typeof channel.isTextBased === "function"
        && !channel.isTextBased()
    ) {
        throw new MessageCleanupError(
            "UNSUPPORTED_CHANNEL",
            `El canal ${channelId} no admite historial de mensajes`,
        );
    }
    if (typeof channel?.messages?.fetch !== "function" || typeof channel.bulkDelete !== "function") {
        throw new MessageCleanupError(
            "UNSUPPORTED_CHANNEL",
            `El canal ${channelId} no permite limpiar mensajes`,
        );
    }

    const botMember = guild?.members?.me;
    const permissions = typeof channel.permissionsFor === "function" && botMember
        ? channel.permissionsFor(botMember)
        : null;
    const requiredPermissions = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
    ];
    if (!permissions || !permissions.has(requiredPermissions)) {
        throw new MessageCleanupError(
            "MISSING_PERMISSIONS",
            `Faltan permisos para limpiar el canal ${channelId}`,
        );
    }
};

const CollectionToMessages = (collection) => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection.values === "function") return [...collection.values()];
    return [];
};

const Chunk = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const DeleteMessageBatch = async ({ channel, messages, now, logger, context }) => {
    const summary = { deleted: 0, failed: 0 };
    const recentCutoff = now.getTime() - FOURTEEN_DAYS_MS + BULK_DELETE_SAFETY_MS;
    const recent = [];
    const old = [];

    for (const message of messages) {
        if (message.createdTimestamp >= recentCutoff) recent.push(message);
        else old.push(message);
    }

    for (const batch of Chunk(recent, MAX_BULK_DELETE_SIZE)) {
        try {
            const deleted = await channel.bulkDelete(batch.map((message) => message.id), true);
            summary.deleted += typeof deleted?.size === "number" ? deleted.size : batch.length;
        } catch (error) {
            summary.failed += batch.length;
            logger.error("[message-cleanup] Falló un borrado masivo", context, error);
        }
    }

    // Discord no admite mensajes de 14 días o más en bulkDelete.
    // Se eliminan en serie para mantener una presión predecible sobre la API.
    for (const message of old) {
        try {
            await message.delete();
            summary.deleted += 1;
        } catch (error) {
            summary.failed += 1;
            logger.error(
                "[message-cleanup] Falló el borrado individual",
                { ...context, messageId: message.id },
                error,
            );
        }
    }

    return summary;
};

const CutoffToBeforeSnowflake = (cutoff) => (
    SnowflakeUtil.generate({ timestamp: cutoff.getTime() + 1 }).toString()
);

const DeleteChannelMessages = async ({
    client,
    serverId,
    channelId,
    cutoff = null,
    shouldDelete = () => true,
    maxMessages = DEFAULT_MAX_MESSAGES,
    pageSize = DEFAULT_PAGE_SIZE,
    now = () => new Date(),
    logger = console,
}) => {
    if (!Number.isInteger(maxMessages) || maxMessages <= 0) {
        throw new RangeError("maxMessages debe ser un entero positivo");
    }
    if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > DEFAULT_PAGE_SIZE) {
        throw new RangeError("pageSize debe estar entre 1 y 100");
    }
    if (cutoff !== null && (!(cutoff instanceof Date) || !Number.isFinite(cutoff.getTime()))) {
        throw new TypeError("cutoff debe ser una fecha válida");
    }

    let guild;
    let channel;
    try {
        guild = await ResolveCleanupGuild(client, serverId);
        if (!guild) {
            throw new MessageCleanupError(
                "GUILD_NOT_FOUND",
                `No se encontró el servidor ${serverId}`,
            );
        }
        channel = await ResolveCleanupChannel(guild, channelId);
    } catch (error) {
        if (error instanceof MessageCleanupError) throw error;
        throw new MessageCleanupError("DISCORD_RESOLUTION_FAILED", "Discord no pudo resolver el canal", error);
    }
    AssertCleanupChannel(guild, channel, serverId, channelId);

    const context = { serverId, channelId };
    const summary = {
        fetched: 0,
        eligible: 0,
        deleted: 0,
        failed: 0,
        pinned: 0,
        pages: 0,
        limitReached: false,
    };
    let before = cutoff ? CutoffToBeforeSnowflake(cutoff) : undefined;

    while (summary.fetched < maxMessages) {
        const limit = Math.min(pageSize, maxMessages - summary.fetched);
        let collection;
        try {
            collection = await channel.messages.fetch({
                limit,
                ...(before ? { before } : {}),
            });
        } catch (error) {
            throw new MessageCleanupError("MESSAGE_FETCH_FAILED", "No se pudo obtener el historial", error);
        }

        const messages = CollectionToMessages(collection);
        if (messages.length === 0) break;

        summary.pages += 1;
        summary.fetched += messages.length;
        const deletable = [];
        for (const message of messages) {
            if (message.pinned) {
                summary.pinned += 1;
                continue;
            }
            if (cutoff && message.createdTimestamp > cutoff.getTime()) continue;
            if (await shouldDelete(message)) deletable.push(message);
        }
        summary.eligible += deletable.length;

        const deletion = await DeleteMessageBatch({
            channel,
            messages: deletable,
            now: now(),
            logger,
            context,
        });
        summary.deleted += deletion.deleted;
        summary.failed += deletion.failed;

        const oldest = messages.at(-1);
        if (!oldest?.id || messages.length < limit) break;
        before = oldest.id;
    }

    summary.limitReached = summary.fetched >= maxMessages;
    return summary;
};

module.exports = {
    DEFAULT_PAGE_SIZE,
    DEFAULT_MAX_MESSAGES,
    MAX_BULK_DELETE_SIZE,
    FOURTEEN_DAYS_MS,
    MessageCleanupError,
    ResolveCleanupGuild,
    ResolveCleanupChannel,
    AssertCleanupChannel,
    CutoffToBeforeSnowflake,
    DeleteChannelMessages,
};
