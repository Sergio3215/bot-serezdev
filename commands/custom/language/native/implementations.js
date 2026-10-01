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
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

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

const CreateMemberValue = (guildMember) => Object.freeze({
    id: guildMember.id,
    displayName: guildMember.displayName,
    bot: guildMember.user.bot,
    roles: Object.freeze(
        Array.from(guildMember.roles.cache.values(), (role) => Role(role.id)),
    ),
});

const GetMember = async (runtimeContext, userId) => {
    if (typeof userId !== "string" || !SNOWFLAKE_PATTERN.test(userId)) {
        throw new TypeError("GetMember requiere un identificador de Discord válido");
    }

    if (!runtimeContext.guild?.members) {
        throw new TypeError("No existe un servidor disponible para buscar el miembro");
    }

    try {
        const guildMember = runtimeContext.guild.members.cache?.get(userId)
            ?? await runtimeContext.guild.members.fetch(userId);

        return guildMember ? CreateMemberValue(guildMember) : null;
    } catch {
        return null;
    }
};

const GetMembers = async (runtimeContext) => {
    if (!runtimeContext.guild?.members?.cache) {
        throw new TypeError("No existe un servidor disponible para consultar miembros");
    }

    return Object.freeze(
        Array.from(runtimeContext.guild.members.cache.values(), CreateMemberValue),
    );
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
    GetMember,
    GetMembers,
    HasRole,
    AddRole,
    BuildEmbed,
    SendMessage,
    ReplyMessage,
    SendEmbed,
    ReplyEmbed,
};
