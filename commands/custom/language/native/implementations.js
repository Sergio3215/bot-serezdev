const { EmbedBuilder } = require("discord.js");

const EMBED_ATTRIBUTE_KEYS = Object.freeze([
    "title",
    "description",
    "color",
    "url",
    "image",
    "author",
    "footer",
]);
const SEND_MESSAGE_KEYS = Object.freeze(["channel", "message"]);
const REPLY_MESSAGE_KEYS = Object.freeze(["message"]);
const SEND_EMBED_KEYS = Object.freeze(["channel", "message", ...EMBED_ATTRIBUTE_KEYS]);
const REPLY_EMBED_KEYS = Object.freeze(["message", ...EMBED_ATTRIBUTE_KEYS]);
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const USER_MENTION_PATTERN = /<@!?(\d{17,20})>/g;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const INTEGER_STRING_PATTERN = /^[+-]?\d+$/;
const DECIMAL_STRING_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;

const AssertConfig = (config, functionName) => {
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
        throw new TypeError(`${functionName} requiere un objeto de configuración`);
    }
};

const AssertKnownProperties = (config, allowedProperties, functionName) => {
    for (const property of Object.keys(config)) {
        if (!allowedProperties.includes(property)) {
            throw new TypeError(`${functionName} no admite la propiedad ${property}`);
        }
    }
};

const AssertOptionalString = (value, property, maximum) => {
    if (value === undefined) {
        return;
    }

    if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
        throw new TypeError(`${property} debe ser un string de entre 1 y ${maximum} caracteres`);
    }
};

const AssertHttpUrl = (value, property) => {
    if (value === undefined) {
        return;
    }

    AssertOptionalString(value, property, 2048);

    let parsedUrl;
    try {
        parsedUrl = new URL(value);
    } catch {
        throw new TypeError(`${property} debe ser una URL HTTP o HTTPS válida`);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new TypeError(`${property} debe ser una URL HTTP o HTTPS válida`);
    }
};

const AssertMessage = (message, required) => {
    if (message === undefined && !required) {
        return;
    }

    if (typeof message !== "string" || message.length < 1 || message.length > 2000) {
        throw new TypeError("message debe ser un string de entre 1 y 2000 caracteres");
    }
};

const ResolveChannel = async (runtimeContext, channelReference) => {
    if (channelReference === undefined) {
        if (!runtimeContext.channel || typeof runtimeContext.channel.send !== "function") {
            throw new TypeError("El canal del mensaje no permite enviar contenido");
        }

        return runtimeContext.channel;
    }

    if (
        channelReference === null
        || typeof channelReference !== "object"
        || typeof channelReference.id !== "string"
        || channelReference.id.length === 0
    ) {
        throw new TypeError("channel debe ser una referencia de canal válida");
    }

    if (!runtimeContext.guild?.channels) {
        throw new TypeError("No existe un servidor disponible para resolver el canal");
    }

    const channel = runtimeContext.guild.channels.cache?.get(channelReference.id)
        ?? await runtimeContext.guild.channels.fetch(channelReference.id);

    if (!channel || typeof channel.send !== "function" || (channel.isTextBased && !channel.isTextBased())) {
        throw new TypeError("El canal indicado no permite enviar contenido");
    }

    return channel;
};

const RequireSourceMessage = (runtimeContext) => {
    if (!runtimeContext.sourceMessage || typeof runtimeContext.sourceMessage.reply !== "function") {
        throw new TypeError("No existe un mensaje de origen al cual responder");
    }

    return runtimeContext.sourceMessage;
};

const Channel = (channelId) => {
    if (typeof channelId !== "string" || !SNOWFLAKE_PATTERN.test(channelId)) {
        throw new TypeError("Channel requiere un identificador de Discord válido");
    }

    return Object.freeze({ id: channelId });
};

const Role = (roleId) => {
    if (typeof roleId !== "string" || !SNOWFLAKE_PATTERN.test(roleId)) {
        throw new TypeError("Role requiere un identificador de Discord válido");
    }

    return Object.freeze({ id: roleId });
};

const NativeService = (runtimeContext, name, fallback) => {
    const service = runtimeContext?.nativeServices?.[name];
    if (service !== undefined && typeof service !== "function") {
        throw new TypeError(`El servicio nativo ${name} es inválido`);
    }
    return service ?? fallback;
};

const RandomValue = (runtimeContext) => {
    const value = NativeService(runtimeContext, "random", Math.random)();
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
        throw new TypeError("La fuente aleatoria debe devolver un número entre 0 inclusive y 1 exclusivo");
    }
    return value;
};

const TimestampValue = (runtimeContext) => {
    const value = NativeService(runtimeContext, "now", Date.now)();
    if (!Number.isInteger(value) || !Number.isFinite(value)) {
        throw new TypeError("La fuente de tiempo debe devolver un timestamp entero en milisegundos");
    }
    return value;
};

const random = (runtimeContext) => RandomValue(runtimeContext);

const randomRange = (runtimeContext, min, max) => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
        throw new TypeError("randomRange requiere dos enteros seguros");
    }
    if (min > max) {
        throw new RangeError("randomRange requiere que min sea menor o igual que max");
    }
    if (min === max) return min;

    const range = max - min + 1;
    if (!Number.isSafeInteger(range)) {
        throw new RangeError("El rango de randomRange es demasiado grande");
    }
    return min + Math.floor(RandomValue(runtimeContext) * range);
};

const choose = (runtimeContext, values) => {
    if (!Array.isArray(values)) {
        throw new TypeError("choose requiere un array");
    }
    if (values.length === 0) {
        throw new RangeError("choose requiere un array no vacío");
    }
    return values[Math.floor(RandomValue(runtimeContext) * values.length)];
};

const now = (runtimeContext) => TimestampValue(runtimeContext);

const date = (runtimeContext) => new Date(TimestampValue(runtimeContext))
    .toISOString()
    .slice(0, 10);

const time = (runtimeContext) => new Date(TimestampValue(runtimeContext))
    .toISOString()
    .slice(11, 19);

const username = (runtimeContext) => {
    const value = runtimeContext?.sourceMessage?.author?.username;
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("No existe un username de autor disponible");
    }
    return value;
};

const displayName = (runtimeContext) => {
    const value = runtimeContext?.authorMember?.displayName;
    return typeof value === "string" && value.length > 0
        ? value
        : username(runtimeContext);
};

const userId = (runtimeContext) => {
    const value = runtimeContext?.sourceMessage?.author?.id;
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("No existe un identificador de autor disponible");
    }
    return value;
};

const channelId = (runtimeContext) => {
    const value = runtimeContext?.channel?.id
        ?? runtimeContext?.sourceMessage?.channel?.id;
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("No existe un identificador de canal disponible");
    }
    return value;
};

const serverId = (runtimeContext) => {
    const value = runtimeContext?.guild?.id;
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("No existe un identificador de servidor disponible");
    }
    return value;
};

const memberCount = (runtimeContext) => {
    const value = runtimeContext?.guild?.memberCount;
    if (!Number.isInteger(value) || value < 0) {
        throw new TypeError("No existe una cantidad de miembros válida disponible");
    }
    return value;
};

const upper = (value) => {
    if (typeof value !== "string") {
        throw new TypeError("upper requiere un String");
    }
    return value.toUpperCase();
};

const lower = (value) => {
    if (typeof value !== "string") {
        throw new TypeError("lower requiere un String");
    }
    return value.toLowerCase();
};

const length = (value) => {
    if (typeof value !== "string" && !Array.isArray(value)) {
        throw new TypeError("length requiere un String o un Array");
    }
    return value.length;
};

const string = (value) => {
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number" && Number.isFinite(value)) return value.toString();
    throw new TypeError("string requiere un String, Number o Boolean válido");
};

const int = (value) => {
    let numericValue;

    if (typeof value === "number") {
        numericValue = value;
    } else if (typeof value === "string" && INTEGER_STRING_PATTERN.test(value)) {
        numericValue = Number(value);
    } else {
        throw new TypeError("int requiere un Number finito o un String integer válido");
    }

    if (!Number.isFinite(numericValue)) {
        throw new TypeError("int no puede convertir un valor no finito");
    }

    const result = Number.isInteger(numericValue)
        ? numericValue
        : Math.trunc(numericValue);
    return Object.is(result, -0) ? 0 : result;
};

const decimal = (value) => {
    let numericValue;

    if (typeof value === "number") {
        numericValue = value;
    } else if (typeof value === "string" && DECIMAL_STRING_PATTERN.test(value)) {
        numericValue = Number(value);
    } else {
        throw new TypeError("decimal requiere un Number finito o un String decimal válido");
    }

    if (!Number.isFinite(numericValue)) {
        throw new TypeError("decimal no puede convertir un valor no finito");
    }

    return numericValue;
};

const bool = (value) => {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new TypeError('bool requiere un Boolean o el String exacto "true" o "false"');
};

const CreateMemberValue = (guildMember) => Object.freeze({
    id: guildMember.id,
    displayName: guildMember.displayName,
    bot: guildMember.user.bot,
    roles: Object.freeze(
        Array.from(guildMember.roles.cache.values(), (role) => Role(role.id)),
    ),
});

const ResolveGuildMember = async (runtimeContext, userId) => {
    if (!runtimeContext.guild?.members) {
        throw new TypeError("No existe un servidor disponible para buscar el miembro");
    }

    try {
        return runtimeContext.guild.members.cache?.get(userId)
            ?? await runtimeContext.guild.members.fetch(userId);
    } catch {
        return null;
    }
};

const GetMentionedUserIds = (runtimeContext) => {
    const content = runtimeContext.sourceMessage?.content;
    if (typeof content !== "string") {
        throw new TypeError("No existe un mensaje de origen para consultar menciones");
    }

    const userIds = [];
    const seen = new Set();
    let match;

    USER_MENTION_PATTERN.lastIndex = 0;
    while ((match = USER_MENTION_PATTERN.exec(content)) !== null) {
        const userId = match[1];
        if (!seen.has(userId)) {
            seen.add(userId);
            userIds.push(userId);
        }
    }

    return userIds;
};

const ResolveMentionContext = async (runtimeContext) => {
    const mentionedMembers = [];

    for (const userId of GetMentionedUserIds(runtimeContext)) {
        const guildMember = await ResolveGuildMember(runtimeContext, userId);
        if (guildMember) {
            mentionedMembers.push(CreateMemberValue(guildMember));
        }
    }

    const frozenMembers = Object.freeze(mentionedMembers);

    return Object.freeze({
        mentionedMember: frozenMembers[0] ?? null,
        mentionedMembers: frozenMembers,
    });
};

const GetMember = async (runtimeContext, userId) => {
    if (typeof userId !== "string" || !SNOWFLAKE_PATTERN.test(userId)) {
        throw new TypeError("GetMember requiere un identificador de Discord válido");
    }

    const guildMember = await ResolveGuildMember(runtimeContext, userId);
    return guildMember ? CreateMemberValue(guildMember) : null;
};

const GetMembers = async (runtimeContext) => {
    if (!runtimeContext.guild?.members?.cache) {
        throw new TypeError("No existe un servidor disponible para consultar miembros");
    }

    return Object.freeze(
        Array.from(runtimeContext.guild.members.cache.values(), CreateMemberValue),
    );
};

const GetAuthor = (runtimeContext) => {
    if (!runtimeContext.authorMember) {
        throw new TypeError("No existe un autor disponible para ejecutar el comando");
    }

    return CreateMemberValue(runtimeContext.authorMember);
};

const GetMentionedMember = async (runtimeContext) => {
    const mentionContext = runtimeContext.mentionContext
        ?? await ResolveMentionContext(runtimeContext);

    if (mentionContext.mentionedMember === null) {
        throw new TypeError("GetMentionedMember requiere mencionar a un miembro del servidor");
    }

    return mentionContext.mentionedMember;
};

const GetMentionedMembers = async (runtimeContext) => {
    const mentionContext = runtimeContext.mentionContext
        ?? await ResolveMentionContext(runtimeContext);

    if (mentionContext.mentionedMembers.length === 0) {
        throw new TypeError("GetMentionedMembers requiere mencionar a un miembro del servidor");
    }

    return mentionContext.mentionedMembers;
};

const HasRole = (member, role) => {
    if (!member || !Array.isArray(member.roles)) {
        throw new TypeError("HasRole requiere un Member válido");
    }

    if (!role || typeof role.id !== "string") {
        throw new TypeError("HasRole requiere un RoleReference válido");
    }

    return member.roles.some((memberRole) => memberRole.id === role.id);
};

const AddRole = async (runtimeContext, member, role) => {
    if (!member || typeof member.id !== "string") {
        throw new TypeError("AddRole requiere un Member válido");
    }

    if (!role || typeof role.id !== "string") {
        throw new TypeError("AddRole requiere un RoleReference válido");
    }

    if (!runtimeContext.guild?.members || !runtimeContext.guild?.roles) {
        throw new TypeError("No existe un servidor disponible para agregar el rol");
    }

    const guildMember = runtimeContext.guild.members.cache?.get(member.id)
        ?? await runtimeContext.guild.members.fetch(member.id);
    const guildRole = runtimeContext.guild.roles.cache?.get(role.id)
        ?? await runtimeContext.guild.roles.fetch(role.id);

    if (!guildMember) {
        throw new TypeError("El miembro indicado no existe en el servidor");
    }

    if (!guildRole) {
        throw new TypeError("El rol indicado no existe en el servidor");
    }

    await guildMember.roles.add(guildRole);
};

const BuildEmbed = (config) => {
    AssertConfig(config, "SendEmbed o ReplyEmbed");

    if (!EMBED_ATTRIBUTE_KEYS.some((key) => config[key] !== undefined)) {
        throw new TypeError("El embed debe contener al menos un atributo propio");
    }

    AssertOptionalString(config.title, "title", 256);
    AssertOptionalString(config.description, "description", 4096);

    if (config.color !== undefined && (typeof config.color !== "string" || !COLOR_PATTERN.test(config.color))) {
        throw new TypeError("color debe utilizar el formato #RRGGBB");
    }

    AssertHttpUrl(config.url, "url");
    AssertHttpUrl(config.image, "image");

    if (config.author !== undefined) {
        AssertConfig(config.author, "author");
        AssertKnownProperties(config.author, ["name", "icon", "url"], "author");
        AssertOptionalString(config.author.name, "author.name", 256);
        if (config.author.name === undefined) {
            throw new TypeError("author.name es obligatorio");
        }
        AssertHttpUrl(config.author.icon, "author.icon");
        AssertHttpUrl(config.author.url, "author.url");
    }

    if (config.footer !== undefined) {
        AssertConfig(config.footer, "footer");
        AssertKnownProperties(config.footer, ["text", "icon"], "footer");
        AssertOptionalString(config.footer.text, "footer.text", 2048);
        if (config.footer.text === undefined) {
            throw new TypeError("footer.text es obligatorio");
        }
        AssertHttpUrl(config.footer.icon, "footer.icon");
    }

    const totalCharacters = (config.title?.length ?? 0)
        + (config.description?.length ?? 0)
        + (config.author?.name?.length ?? 0)
        + (config.footer?.text?.length ?? 0);

    if (totalCharacters > 6000) {
        throw new TypeError("El contenido total del embed no puede superar 6000 caracteres");
    }

    const embed = new EmbedBuilder();

    if (config.title !== undefined) embed.setTitle(config.title);
    if (config.description !== undefined) embed.setDescription(config.description);
    if (config.color !== undefined) embed.setColor(config.color);
    if (config.url !== undefined) embed.setURL(config.url);
    if (config.image !== undefined) embed.setImage(config.image);

    if (config.author !== undefined) {
        embed.setAuthor({
            name: config.author.name,
            ...(config.author.icon === undefined ? {} : { iconURL: config.author.icon }),
            ...(config.author.url === undefined ? {} : { url: config.author.url }),
        });
    }

    if (config.footer !== undefined) {
        embed.setFooter({
            text: config.footer.text,
            ...(config.footer.icon === undefined ? {} : { iconURL: config.footer.icon }),
        });
    }

    return embed;
};

const CreateEmbedPayload = (config) => {
    AssertMessage(config.message, false);

    return {
        ...(config.message === undefined ? {} : { content: config.message }),
        embeds: [BuildEmbed(config)],
    };
};

const SendMessage = async (runtimeContext, config) => {
    AssertConfig(config, "SendMessage");
    AssertKnownProperties(config, SEND_MESSAGE_KEYS, "SendMessage");
    AssertMessage(config.message, true);

    const channel = await ResolveChannel(runtimeContext, config.channel);
    await channel.send({ content: config.message });
};

const ReplyMessage = async (runtimeContext, config) => {
    AssertConfig(config, "ReplyMessage");
    AssertKnownProperties(config, REPLY_MESSAGE_KEYS, "ReplyMessage");
    AssertMessage(config.message, true);

    const sourceMessage = RequireSourceMessage(runtimeContext);
    await sourceMessage.reply({ content: config.message });
};

const SendEmbed = async (runtimeContext, config) => {
    AssertConfig(config, "SendEmbed");
    AssertKnownProperties(config, SEND_EMBED_KEYS, "SendEmbed");

    const channel = await ResolveChannel(runtimeContext, config.channel);
    await channel.send(CreateEmbedPayload(config));
};

const ReplyEmbed = async (runtimeContext, config) => {
    AssertConfig(config, "ReplyEmbed");
    AssertKnownProperties(config, REPLY_EMBED_KEYS, "ReplyEmbed");

    const sourceMessage = RequireSourceMessage(runtimeContext);
    await sourceMessage.reply(CreateEmbedPayload(config));
};

module.exports = {
    Channel,
    Role,
    random,
    randomRange,
    choose,
    now,
    date,
    time,
    username,
    displayName,
    userId,
    channelId,
    serverId,
    memberCount,
    upper,
    lower,
    length,
    string,
    int,
    decimal,
    bool,
    GetMember,
    GetMembers,
    GetAuthor,
    ResolveMentionContext,
    GetMentionedMember,
    GetMentionedMembers,
    HasRole,
    AddRole,
    BuildEmbed,
    SendMessage,
    ReplyMessage,
    SendEmbed,
    ReplyEmbed,
};
