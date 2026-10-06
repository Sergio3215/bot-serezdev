const test = require("node:test");
const assert = require("node:assert/strict");

const { ChannelType } = require("discord.js");
const LibsCommands = require("../commands/lib.js");
const { LibAutocomplete } = require("../slash command/lib-autocomplete.js");
const { ContadorCommand } = require("../db/index.js");

const GUILD_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";

const CreateChannel = (overrides = {}) => ({
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    name: "contador",
    type: ChannelType.GuildText,
    viewable: true,
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    async send() {},
    ...overrides,
});

const CreateInteraction = ({ channelId = CHANNEL_ID, channel = CreateChannel(), fetchError = null } = {}) => {
    const replies = [];
    let getStringCalls = 0;
    const options = {
        getString(name, required) {
            getStringCalls += 1;
            assert.equal(name, "canal");
            assert.equal(required, true);
            return channelId;
        },
    };
    Object.defineProperty(options, "_hoistedOptions", {
        get() { throw new Error("No debe leer _hoistedOptions"); },
    });

    const interaction = {
        guild: {
            id: GUILD_ID,
            name: "Guild",
            channels: {
                cache: new Map(channel ? [[channel.id, channel]] : []),
                async fetch(id) {
                    if (fetchError) throw fetchError;
                    return channel?.id === id ? channel : null;
                },
            },
        },
        options,
        replies,
        async reply(payload) {
            replies.push(payload);
        },
    };

    return { interaction, replies, get getStringCalls() { return getStringCalls; } };
};

const CreateDb = (existing = []) => {
    const calls = [];
    return {
        calls,
        async GetById(serverId) {
            calls.push({ method: "GetById", serverId });
            return existing;
        },
        async Create(data) {
            calls.push({ method: "Create", data });
        },
        async Update(serverId, data) {
            calls.push({ method: "Update", serverId, data });
        },
    };
};

const CreateLib = (counterDb, logger = { error() {} }) => new LibsCommands({ counterDb, logger });

test("/contador crea configuración válida usando getString público", async () => {
    const db = CreateDb();
    const fixture = CreateInteraction();

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, true);
    assert.equal(fixture.getStringCalls, 1);
    assert.deepEqual(db.calls[1], {
        method: "Create",
        data: {
            serverId: GUILD_ID,
            serverName: "Guild",
            modifiedBy: "",
            channelId: CHANNEL_ID,
        },
    });
    assert.match(fixture.replies[0], /establecido correctamente/);
});

test("/contador actualiza sólo channelId y preserva la racha existente", async () => {
    const db = CreateDb([{ serverId: GUILD_ID, count: 19, modifiedBy: "user-a" }]);
    const fixture = CreateInteraction();

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, true);
    assert.deepEqual(db.calls[1], {
        method: "Update",
        serverId: GUILD_ID,
        data: { channelId: CHANNEL_ID },
    });
    assert.equal(Object.hasOwn(db.calls[1].data, "count"), false);
    assert.equal(Object.hasOwn(db.calls[1].data, "modifiedBy"), false);
});

test("reconfigurar el canal renueva modifiedOn sin reescribir la racha", async () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    let updateInput;
    const db = new ContadorCommand({
        now: () => now,
        client: {
            ContadorCommand: {
                async update(input) {
                    updateInput = input;
                },
            },
        },
    });

    await db.Update(GUILD_ID, { channelId: CHANNEL_ID });

    assert.deepEqual(updateInput, {
        where: { serverId: GUILD_ID },
        data: { modifiedOn: now, channelId: CHANNEL_ID },
    });
    assert.equal(Object.hasOwn(updateInput.data, "count"), false);
    assert.equal(Object.hasOwn(updateInput.data, "modifiedBy"), false);
});

test("/contador rechaza un valor arbitrario sin consultar ni persistir", async () => {
    const db = CreateDb();
    const fixture = CreateInteraction({ channelId: "abc", channel: null });

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, false);
    assert.deepEqual(db.calls, []);
    assert.match(fixture.replies[0].content, /no es válido/i);
});

test("/contador rechaza un snowflake cuyo canal no existe", async () => {
    const db = CreateDb();
    const fixture = CreateInteraction({ channel: null });

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, false);
    assert.deepEqual(db.calls, []);
});

test("/contador rechaza un canal de otro guild", async () => {
    const db = CreateDb();
    const fixture = CreateInteraction({
        channel: CreateChannel({ guildId: "333333333333333333" }),
    });

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, false);
    assert.deepEqual(db.calls, []);
});

test("/contador rechaza un canal sin permisos suficientes", async () => {
    const db = CreateDb();
    const fixture = CreateInteraction({
        channel: CreateChannel({ permissionsFor: () => ({ has: () => false }) }),
    });

    const result = await CreateLib(db).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, false);
    assert.deepEqual(db.calls, []);
});

test("/contador responde de forma controlada ante un fallo DB", async () => {
    const logger = { entries: [], error(...args) { this.entries.push(args); } };
    const db = CreateDb();
    db.GetById = async () => { throw new Error("DB offline"); };
    const fixture = CreateInteraction();

    const result = await CreateLib(db, logger).ContadorCommand({ user: { id: "bot" } }, fixture.interaction);

    assert.equal(result, false);
    assert.equal(logger.entries.length, 1);
    assert.match(fixture.replies[0].content, /no se pudo configurar/i);
});

test("autocomplete limita a 25 canales útiles y espera respond", async () => {
    const channels = new Map();
    for (let index = 0; index < 30; index += 1) {
        const id = String(300000000000000000n + BigInt(index));
        channels.set(id, CreateChannel({ id, name: `general-${index}` }));
    }
    channels.set("444444444444444444", CreateChannel({
        id: "444444444444444444",
        name: "voz",
        type: ChannelType.GuildVoice,
    }));
    const responses = [];
    const interaction = {
        commandName: "contador",
        responded: false,
        guild: { channels: { async fetch() { return channels; } } },
        options: { getFocused: () => ({ value: "general" }) },
        async respond(payload) {
            this.responded = true;
            responses.push(payload);
        },
    };

    await LibAutocomplete({ user: { id: "bot" } }, interaction, true, false);

    assert.equal(responses.length, 1);
    assert.equal(responses[0].length, 25);
    assert.equal(responses[0].every((option) => option.name.startsWith("general")), true);
});

test("autocomplete responde vacío si Discord falla y no duplica respuestas", async () => {
    const responses = [];
    const interaction = {
        commandName: "contador",
        responded: false,
        guild: { channels: { async fetch() { throw new Error("Discord unavailable"); } } },
        async respond(payload) {
            this.responded = true;
            responses.push(payload);
        },
    };

    await LibAutocomplete({ user: { id: "bot" } }, interaction, true, false);

    assert.deepEqual(responses, [[]]);
});
