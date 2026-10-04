const test = require("node:test");
const assert = require("node:assert/strict");

const LibsCommands = require("../commands/lib.js");

const SERVER_ID = "server-current";
const CUSTOM_TITLE = "Comandos personalizados";
const ADMIN_TITLE = "Lista de Comandos para Administradores y Moderadores";

const createHarness = (records, {
    generatedContent = "Descripción generada",
    generationError = null,
} = {}) => {
    const generatedPrompts = [];
    const descriptionUpdates = [];
    const loggedErrors = [];
    const replies = [];
    const customCommandDb = {
        async GetByServerId(serverId) {
            assert.equal(serverId, SERVER_ID);
            return records;
        },
        async UpdateDescription(id, description) {
            descriptionUpdates.push({ id, description });
            const command = records.find((record) => record.id === id);
            if (command) command.description = description;
            return command;
        },
    };
    const generateTextSystem = async (prompt) => {
        generatedPrompts.push(prompt);
        if (generationError) throw generationError;
        return { choices: [{ message: { content: generatedContent } }] };
    };
    const lib = new LibsCommands({
        customCommandDb,
        generateTextSystem,
        logger: { error: (...values) => loggedErrors.push(values) },
    });
    const msg = {
        guild: { id: SERVER_ID },
        async reply(payload) {
            replies.push(payload);
        },
    };

    return {
        generatedPrompts,
        descriptionUpdates,
        loggedErrors,
        async render({ isMod = false, isAdmin = false } = {}) {
            await lib.Comandos(isMod, isAdmin, msg);
            return replies.at(-1).embeds.map((embed) => embed.toJSON());
        },
    };
};

const customEmbed = (embeds) => embeds.find((embed) => embed.title === CUSTOM_TITLE);
const customContent = (embeds) => customEmbed(embeds)
    ?.fields.map((field) => field.value).join("\n");

test("description existente o manual se usa sin llamar OpenAI", async () => {
    const harness = createHarness([{
        id: "command-1",
        serverId: SERVER_ID,
        command: "!hola",
        code: "secret code",
        description: "Saluda a la comunidad",
        enabled: true,
    }]);

    const embeds = await harness.render();

    assert.match(customContent(embeds), /^!hola\nSaluda a la comunidad$/m);
    assert.equal(harness.generatedPrompts.length, 0);
    assert.equal(harness.descriptionUpdates.length, 0);
});

test("description null genera, persiste y muestra el resultado", async () => {
    const harness = createHarness([{
        id: "command-1",
        serverId: SERVER_ID,
        command: "saludar",
        code: "SendMessage('Hola')",
        description: null,
        enabled: true,
    }], { generatedContent: "  Envía un saludo al canal.  " });

    const embeds = await harness.render();

    assert.equal(harness.generatedPrompts.length, 1);
    assert.match(harness.generatedPrompts[0], /Código:\nSendMessage\('Hola'\)$/);
    assert.deepEqual(harness.descriptionUpdates, [{
        id: "command-1",
        description: "Envía un saludo al canal.",
    }]);
    assert.match(customContent(embeds), /^!saludar\nEnvía un saludo al canal\.$/m);
});

test("la segunda ejecución reutiliza la description persistida", async () => {
    const records = [{
        id: "command-1",
        serverId: SERVER_ID,
        command: "hola",
        code: "SendMessage('Hola')",
        description: undefined,
        enabled: true,
    }];
    const harness = createHarness(records);

    await harness.render();
    await harness.render();

    assert.equal(harness.generatedPrompts.length, 1);
    assert.equal(harness.descriptionUpdates.length, 1);
    assert.equal(records[0].description, "Descripción generada");
});

test("disabled y comandos de otro servidor no generan description", async () => {
    const harness = createHarness([
        {
            id: "visible",
            serverId: SERVER_ID,
            command: "visible",
            description: "Es visible",
            enabled: true,
        },
        {
            id: "disabled",
            serverId: SERVER_ID,
            command: "oculto",
            code: "secret",
            description: null,
            enabled: false,
        },
        {
            id: "external",
            serverId: "server-other",
            command: "externo",
            code: "secret",
            description: null,
            enabled: true,
        },
    ]);

    const embeds = await harness.render();

    assert.match(customContent(embeds), /!visible\nEs visible/);
    assert.doesNotMatch(customContent(embeds), /oculto|externo/);
    assert.equal(harness.generatedPrompts.length, 0);
});

test("un string vacío no se regenera", async () => {
    const harness = createHarness([{
        id: "command-1",
        serverId: SERVER_ID,
        command: "hola",
        code: "secret",
        description: "",
        enabled: true,
    }]);

    const embeds = await harness.render();

    assert.match(customContent(embeds), /^!hola\n​$/m);
    assert.equal(harness.generatedPrompts.length, 0);
    assert.equal(harness.descriptionUpdates.length, 0);
});

test("si OpenAI falla mantiene los embeds y no persiste contenido inválido", async () => {
    const harness = createHarness([{
        id: "command-1",
        serverId: SERVER_ID,
        command: "hola",
        code: "secret",
        description: null,
        enabled: true,
    }], { generationError: new Error("OpenAI unavailable") });

    const embeds = await harness.render();

    assert.equal(embeds.length, 4);
    assert.match(customContent(embeds), /^!hola\n​$/m);
    assert.equal(harness.descriptionUpdates.length, 0);
    assert.equal(harness.loggedErrors.length, 1);
});

test("admin y moderadores conservan su embed junto al personalizado", async () => {
    const harness = createHarness([{
        id: "command-1",
        serverId: SERVER_ID,
        command: "hola",
        description: "Saluda",
        enabled: true,
    }]);
    const embeds = await harness.render({ isAdmin: true });

    assert.ok(embeds.some((embed) => embed.title === ADMIN_TITLE));
    assert.ok(customEmbed(embeds));
});
