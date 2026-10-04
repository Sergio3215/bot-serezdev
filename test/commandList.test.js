const test = require("node:test");
const assert = require("node:assert/strict");
const { Colors } = require("discord.js");

const { CustomCommand } = require("../db/index.js");
const LibsCommands = require("../commands/lib.js");

const SERVER_ID = "server-current";
const CUSTOM_TITLE = "Comandos personalizados";
const ADMIN_TITLE = "Lista de Comandos para Administradores y Moderadores";

const renderCommandList = async (t, records, { isMod = false, isAdmin = false } = {}) => {
    const requestedServerIds = [];
    t.mock.method(CustomCommand.prototype, "GetByServerId", async (serverId) => {
        requestedServerIds.push(serverId);
        if (records instanceof Error) throw records;
        return records;
    });

    const replies = [];
    const msg = {
        guild: { id: SERVER_ID },
        async reply(payload) {
            replies.push(payload);
        },
    };

    await new LibsCommands().Comandos(isMod, isAdmin, msg);

    assert.deepEqual(requestedServerIds, [SERVER_ID]);
    assert.equal(replies.length, 1);

    return replies[0].embeds.map((embed) => embed.toJSON());
};

const findCustomEmbed = (embeds) => embeds.find((embed) => embed.title === CUSTOM_TITLE);

const embedTextLength = (embed) => (
    (embed.title?.length ?? 0)
    + (embed.description?.length ?? 0)
    + (embed.author?.name?.length ?? 0)
    + (embed.footer?.text?.length ?? 0)
    + (embed.fields ?? []).reduce(
        (total, field) => total + field.name.length + field.value.length,
        0,
    )
);

test("sin custom commands envía solamente los embeds existentes", async (t) => {
    const embeds = await renderCommandList(t, []);

    assert.equal(embeds.length, 3);
    assert.equal(findCustomEmbed(embeds), undefined);
});

test("agrega el embed azul con dos comandos habilitados y conserva sus prefijos", async (t) => {
    const embeds = await renderCommandList(t, [
        { serverId: SERVER_ID, command: "!hola", code: "secreto-1", description: "Saluda", enabled: true },
        { serverId: SERVER_ID, command: "reglas", code: "secreto-2", description: "Muestra las reglas", enabled: true },
    ]);
    const customEmbed = findCustomEmbed(embeds);
    const content = customEmbed.fields.map((field) => field.value).join("\n");

    assert.ok(customEmbed);
    assert.equal(customEmbed.color, Colors.Blue);
    assert.match(content, /^!hola$/m);
    assert.match(content, /^!reglas$/m);
    assert.doesNotMatch(content, /!!hola|secreto/);
});

test("omite custom commands deshabilitados", async (t) => {
    const embeds = await renderCommandList(t, [
        { serverId: SERVER_ID, command: "visible", description: "Es visible", enabled: true },
        { serverId: SERVER_ID, command: "oculto", description: null, enabled: false },
    ]);
    const content = findCustomEmbed(embeds).fields.map((field) => field.value).join("\n");

    assert.match(content, /^!visible$/m);
    assert.doesNotMatch(content, /oculto/);
});

test("no mezcla comandos pertenecientes a otro servidor", async (t) => {
    const embeds = await renderCommandList(t, [
        { serverId: SERVER_ID, command: "local", description: "Comando local", enabled: true },
        { serverId: "server-other", command: "externo", description: null, enabled: true },
    ]);
    const content = findCustomEmbed(embeds).fields.map((field) => field.value).join("\n");

    assert.match(content, /^!local$/m);
    assert.doesNotMatch(content, /externo/);
});

test("si falla CustomCommand mantiene operativo el listado existente", async (t) => {
    const loggedErrors = [];
    t.mock.method(console, "error", (...values) => loggedErrors.push(values));

    const embeds = await renderCommandList(t, new Error("database unavailable"));

    assert.equal(embeds.length, 3);
    assert.equal(findCustomEmbed(embeds), undefined);
    assert.equal(loggedErrors.length, 1);
});

test("agrupa una cantidad elevada sin superar los límites de Discord", async (t) => {
    const records = Array.from({ length: 100 }, (_, index) => ({
        serverId: SERVER_ID,
        command: `personalizado-${String(index).padStart(3, "0")}`,
        description: "x",
        enabled: true,
    }));
    const embeds = await renderCommandList(t, records);
    const customEmbed = findCustomEmbed(embeds);
    const displayedCommands = customEmbed.fields
        .flatMap((field) => field.value.split("\n"));

    assert.equal(embeds.length, 4);
    assert.ok(embeds.length <= 10);
    assert.ok(customEmbed.fields.length <= 25);
    assert.ok(customEmbed.fields.every((field) => (
        field.name.length <= 256 && field.value.length <= 1024
    )));
    assert.deepEqual(
        displayedCommands.filter((line) => line.startsWith("!")),
        records.map((record) => `!${record.command}`),
    );
    assert.ok(embeds.reduce((total, embed) => total + embedTextLength(embed), 0) <= 6000);
});

test("moderadores y administradores conservan su embed", async (t) => {
    const embeds = await renderCommandList(t, [
        { serverId: SERVER_ID, command: "hola", description: "Saluda", enabled: true },
    ], { isMod: true });

    assert.ok(embeds.some((embed) => embed.title === ADMIN_TITLE));
    assert.ok(findCustomEmbed(embeds));
});
