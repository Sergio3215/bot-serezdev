const test = require("node:test");
const assert = require("node:assert/strict");
const Discord = require("discord.js");

const {
    PreviewCustomCommand,
    PreviewIds,
    PreviewDefaults,
} = require("../commands/custom/preview.js");
const {
    IsCustomCommandCacheReady,
    GetCustomCommandCacheSummary,
    GetCustomCommandFromMap,
} = require("../commands/custom/index.js");
const {
    createCustomCommandController,
} = require("../server/routes/customCommand/customCommand.controller.js");

const SERVER_ID = "333333333333333333";
const CHANNEL_ID = "444444444444444444";
const ROLE_ID = "555555555555555555";
const FIXED_TIMESTAMP = Date.UTC(2026, 9, 5, 14, 3, 9);
const nativeServices = Object.freeze({
    random: () => 0.5,
    now: () => FIXED_TIMESTAMP,
});

const Preview = (code, extra = {}) => PreviewCustomCommand(
    { serverId: SERVER_ID, code, message: "!probar", ...extra },
    { nativeServices },
);

const SpyOnDiscord = (t) => {
    const calls = [];
    const targets = [
        [Discord.Message.prototype, "reply"],
        [Discord.TextChannel.prototype, "send"],
        [Discord.GuildMemberRoleManager.prototype, "add"],
        [Discord.GuildMemberRoleManager.prototype, "remove"],
        [Discord.Client.prototype, "login"],
    ];

    for (const [prototype, method] of targets) {
        t.mock.method(prototype, method, (...args) => {
            calls.push({ method, args });
        });
    }

    return calls;
};

const CreateDbSpy = () => {
    const calls = [];
    const db = new Proxy({}, {
        get: (_target, property) => (...args) => {
            calls.push({ property, args });
            throw new Error("La base de datos no debe usarse en el preview");
        },
    });
    return { db, calls };
};

const CreateResponse = () => {
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return response;
};

test("source válido sin acciones no produce efectos", async (t) => {
    const discordCalls = SpyOnDiscord(t);
    const result = await Preview('const saludo = "hola"\nconst largo = length(saludo)');

    assert.equal(result.ok, true);
    assert.equal(result.stage, null);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.actions, []);
    assert.equal(discordCalls.length, 0);
});

test("ReplyMessage se captura y no se envía", async (t) => {
    const discordCalls = SpyOnDiscord(t);
    const result = await Preview('ReplyMessage({ message: "Hola " + displayName() })');

    assert.equal(result.ok, true);
    assert.deepEqual(result.actions, [{
        type: "ReplyMessage",
        message: `Hola ${PreviewDefaults.authorDisplayName}`,
    }]);
    assert.equal(discordCalls.length, 0);
});

test("SendMessage se captura con el canal destino y no se envía", async (t) => {
    const discordCalls = SpyOnDiscord(t);
    const result = await Preview([
        'SendMessage({ message: "aquí" })',
        `SendMessage({ channel: Channel("${CHANNEL_ID}"), message: "allá" })`,
    ].join("\n"));

    assert.equal(result.ok, true);
    assert.deepEqual(result.actions, [
        { type: "SendMessage", channelId: PreviewIds.channel, message: "aquí" },
        { type: "SendMessage", channelId: CHANNEL_ID, message: "allá" },
    ]);
    assert.equal(discordCalls.length, 0);
});

test("SendEmbed y ReplyEmbed se capturan con los datos del embed", async (t) => {
    const discordCalls = SpyOnDiscord(t);
    const result = await Preview([
        "ReplyEmbed({",
        '    message: "Mirá",',
        '    title: "Título",',
        '    description: "Descripción",',
        '    color: "#5865f2",',
        '    image: "https://example.com/a.png",',
        '    author: { name: "Serez", icon: "https://example.com/i.png" },',
        '    footer: { text: "Pie" },',
        "})",
        `SendEmbed({ channel: Channel("${CHANNEL_ID}"), title: "Otro" })`,
    ].join("\n"));

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.actions, [
        {
            type: "ReplyEmbed",
            message: "Mirá",
            embed: {
                title: "Título",
                description: "Descripción",
                color: "#5865F2",
                url: null,
                image: "https://example.com/a.png",
                author: { name: "Serez", icon: "https://example.com/i.png", url: null },
                footer: { text: "Pie", icon: null },
            },
        },
        {
            type: "SendEmbed",
            channelId: CHANNEL_ID,
            message: null,
            embed: {
                title: "Otro",
                description: null,
                color: null,
                url: null,
                image: null,
                author: null,
                footer: null,
            },
        },
    ]);
    assert.equal(discordCalls.length, 0);
});

test("AddRole se captura y no se aplica", async (t) => {
    const discordCalls = SpyOnDiscord(t);
    const result = await Preview([
        `AddRole(GetAuthor(), Role("${ROLE_ID}"))`,
        `const tiene = HasRole(GetAuthor(), Role("${ROLE_ID}"))`,
        "ReplyMessage({ message: string(tiene) })",
    ].join("\n"));

    assert.equal(result.ok, true);
    assert.deepEqual(result.actions, [
        {
            type: "AddRole",
            memberId: PreviewIds.author,
            memberName: PreviewDefaults.authorDisplayName,
            roleId: ROLE_ID,
        },
        { type: "ReplyMessage", message: "false" },
    ]);
    assert.equal(discordCalls.length, 0);
});

test("un error de compilación devuelve diagnostics sin ejecutar", async () => {
    const result = await Preview('ReplyMessage({ message: 5 })\nReplyMessage({ message: "no" })');

    assert.equal(result.ok, false);
    assert.equal(result.stage, "compile");
    assert.deepEqual(result.actions, []);
    assert.ok(result.diagnostics.length > 0);
    for (const diagnostic of result.diagnostics) {
        assert.deepEqual(Object.keys(diagnostic).sort(), ["code", "column", "line", "message", "phase"]);
        assert.equal(diagnostic.line, 1);
    }
});

test("un error de runtime devuelve diagnostics controlados y conserva lo capturado antes", async () => {
    const result = await Preview('ReplyMessage({ message: "antes" })\nconst n = int("abc")\nReplyMessage({ message: "después" })');

    assert.equal(result.ok, false);
    assert.equal(result.stage, "runtime");
    assert.deepEqual(result.actions, [{ type: "ReplyMessage", message: "antes" }]);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].code, "NATIVE_EXECUTION_ERROR");
    assert.equal(result.diagnostics[0].line, 2);
    assert.match(result.diagnostics[0].message, /^int: /);
    assert.doesNotMatch(result.diagnostics[0].message, /\n\s+at /);
});

test("las natives del Sprint 2 funcionan en el preview", async () => {
    const result = await Preview([
        "const partes = [",
        "    string(random()),",
        "    string(randomRange(1, 10)),",
        '    choose(["a", "b", "c"]),',
        "    string(now()),",
        "    date(),",
        "    time(),",
        "    username(),",
        "    displayName(),",
        "    userId(),",
        "    channelId(),",
        "    serverId(),",
        "    string(memberCount()),",
        '    upper("x"),',
        '    lower("Y"),',
        '    string(length("abc")),',
        "]",
        "for (const parte of partes) {",
        "    ReplyMessage({ message: parte })",
        "}",
    ].join("\n"));

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.actions.map((action) => action.message), [
        "0.5",
        "6",
        "b",
        String(FIXED_TIMESTAMP),
        "2026-10-05",
        "14:03:09",
        PreviewDefaults.authorUsername,
        PreviewDefaults.authorDisplayName,
        PreviewIds.author,
        PreviewIds.channel,
        SERVER_ID,
        String(PreviewDefaults.memberCount),
        "X",
        "y",
        "3",
    ]);
});

test("las conversiones del Sprint 3 funcionan en el preview", async () => {
    const result = await Preview([
        'const total = int("10") + decimal("2.5")',
        'if (bool("true")) {',
        "    ReplyMessage({ message: string(total) + \" \" + string(int(9.9)) + \" \" + string(false) })",
        "}",
    ].join("\n"));

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.actions, [{ type: "ReplyMessage", message: "12.5 9 false" }]);

    for (const source of ['int("10.5")', 'decimal("abc")', 'bool("hola")']) {
        const failed = await Preview(`const valor = ${source}`);
        assert.equal(failed.stage, "runtime", source);
    }

    for (const source of ["int(true)", "decimal(false)", "bool(1)"]) {
        const failed = await Preview(`const valor = ${source}`);
        assert.equal(failed.stage, "compile", source);
    }
});

test("las natives de contexto usan el contexto simulado y las menciones", async () => {
    const withoutMention = await Preview('ReplyMessage({ message: GetMentionedMember().displayName })');
    assert.equal(withoutMention.ok, false);
    assert.equal(withoutMention.diagnostics[0].code, "MISSING_MENTION");
    assert.equal(withoutMention.actions[0].type, "ReplyMessage");

    const simulated = await Preview(
        'const m = GetMentionedMember()\nReplyMessage({ message: m.displayName + " " + m.id })',
        { mention: true },
    );
    assert.equal(simulated.ok, true, JSON.stringify(simulated.diagnostics));
    assert.equal(simulated.actions[0].message, `${PreviewDefaults.mentionDisplayName} ${PreviewIds.mention}`);
    assert.equal(simulated.context.message, `!probar <@${PreviewIds.mention}>`);
    assert.deepEqual(simulated.context.mentionedMembers, [{
        id: PreviewIds.mention,
        displayName: PreviewDefaults.mentionDisplayName,
    }]);

    const explicit = await Preview(
        "const todos = GetMentionedMembers()\nconst miembros = GetMembers()\nReplyMessage({ message: string(length(todos)) + \"/\" + string(length(miembros)) })",
        { message: "!probar <@666666666666666666> <@777777777777777777>" },
    );
    assert.equal(explicit.ok, true, JSON.stringify(explicit.diagnostics));
    assert.equal(explicit.actions[0].message, "2/3");

    const author = await Preview("const a = GetAuthor()\nReplyMessage({ message: a.id })");
    assert.equal(author.actions[0].message, PreviewIds.author);
    assert.deepEqual(author.context.author, {
        id: PreviewIds.author,
        username: PreviewDefaults.authorUsername,
        displayName: PreviewDefaults.authorDisplayName,
    });
});

test("el controller de preview no usa la base de datos", async () => {
    const { db, calls } = CreateDbSpy();
    const controller = createCustomCommandController(db);
    const res = CreateResponse();

    await controller.previewCustomCommand({
        body: {
            serverId: SERVER_ID,
            code: 'ReplyMessage({ message: "hola" })',
            message: "!hola",
        },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.ok, true);
    assert.deepEqual(res.body.data.actions, [{ type: "ReplyMessage", message: "hola" }]);
    assert.equal(calls.length, 0);
});

test("el controller valida la entrada del preview", async () => {
    const { db, calls } = CreateDbSpy();
    const controller = createCustomCommandController(db);

    for (const body of [
        { code: "const a = 1" },
        { serverId: "abc", code: "const a = 1" },
        { serverId: SERVER_ID, code: "   " },
        { serverId: SERVER_ID, code: "const a = 1", message: 5 },
        { serverId: SERVER_ID, code: "const a = 1", message: "x".repeat(2001) },
    ]) {
        const res = CreateResponse();
        await controller.previewCustomCommand({ body }, res);
        assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    assert.equal(calls.length, 0);
});

test("la respuesta no expone el runtimeContext ni objetos internos", async () => {
    const result = await Preview('ReplyMessage({ message: "x" })');

    assert.deepEqual(Object.keys(result).sort(), ["actions", "context", "diagnostics", "ok", "stage"]);
    const serialized = JSON.stringify(result);
    assert.equal(JSON.parse(serialized).context.serverId, SERVER_ID);
    assert.doesNotMatch(serialized, /runtimeContext|nativeServices|sourceMessage|INTERNAL_API_SECRET/);
});

test("las APIs y globals inseguros siguen bloqueados", async () => {
    for (const name of ["Math", "Date", "process", "require", "eval", "Function", "global", "globalThis", "module", "exports"]) {
        const asValue = await Preview(`const x = ${name}`);
        assert.equal(asValue.stage, "compile", name);
        const asCall = await Preview(`const x = ${name}()`);
        assert.equal(asCall.stage, "compile", name);
    }

    const constructorEscape = await Preview('const x = "a".constructor');
    assert.equal(constructorEscape.stage, "compile");
});

test("el preview no toca el cache productivo", async () => {
    const readyBefore = IsCustomCommandCacheReady();
    const summaryBefore = GetCustomCommandCacheSummary();

    await Preview('ReplyMessage({ message: "hola" })');

    assert.equal(IsCustomCommandCacheReady(), readyBefore);
    assert.equal(GetCustomCommandCacheSummary(), summaryBefore);
    assert.equal(GetCustomCommandFromMap(SERVER_ID, "preview"), null);
});

test("previews simultáneos son independientes", async () => {
    const results = await Promise.all([
        Preview('ReplyMessage({ message: "uno" })'),
        Preview('SendMessage({ message: "dos" })\nSendMessage({ message: "tres" })', { mention: true }),
        Preview('const x = int("x")'),
    ]);

    assert.deepEqual(results[0].actions, [{ type: "ReplyMessage", message: "uno" }]);
    assert.deepEqual(results[0].context.mentionedMembers, []);
    assert.deepEqual(results[1].actions.map((action) => action.message), ["dos", "tres"]);
    assert.equal(results[1].context.mentionedMembers.length, 1);
    assert.deepEqual(results[2].actions, []);
    assert.equal(results[2].stage, "runtime");
});
