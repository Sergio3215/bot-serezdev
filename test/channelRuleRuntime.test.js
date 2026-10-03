const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CreateChannelRuleRuntime,
} = require("../commands/channelRules/runtime.js");

const createMessage = (content, { bot = false, deleteError = null } = {}) => {
    let deletes = 0;

    return {
        guild: { id: "server-a" },
        channel: { id: "channel-1" },
        author: { id: "user-a", bot },
        content,
        get deletes() {
            return deletes;
        },
        async delete() {
            deletes += 1;
            if (deleteError) throw deleteError;
        },
    };
};

const youtubeRule = {
    type: "linkRestriction",
    allowedTypes: ["youtube"],
    mode: "contains",
    enabled: true,
};

test("continúa cuando no hay regla, está deshabilitada o el autor es un bot", async () => {
    let selectedRule = null;
    let lookups = 0;
    const runtime = CreateChannelRuleRuntime({
        getRule() {
            lookups += 1;
            return selectedRule;
        },
    });

    const noRule = await runtime(createMessage("texto"));
    selectedRule = { ...youtubeRule, enabled: false };
    const disabled = await runtime(createMessage("texto"));
    const bot = await runtime(createMessage("texto", { bot: true }));

    assert.equal(noRule.handled, false);
    assert.equal(disabled.handled, false);
    assert.equal(bot.handled, false);
    assert.equal(lookups, 2);
});

test("deja continuar un mensaje válido y borra uno inválido", async () => {
    const runtime = CreateChannelRuleRuntime({ getRule: () => youtubeRule });
    const validMessage = createMessage("Mira https://youtu.be/video");
    const invalidMessage = createMessage("Mira https://example.com/video");

    const valid = await runtime(validMessage);
    const invalid = await runtime(invalidMessage);

    assert.equal(valid.handled, false);
    assert.equal(validMessage.deletes, 0);
    assert.equal(invalid.handled, true);
    assert.equal(invalid.deleted, true);
    assert.equal(invalidMessage.deletes, 1);
});

test("un error al borrar se captura y el mensaje rechazado no sigue al resto del bot", async () => {
    const errors = [];
    const runtime = CreateChannelRuleRuntime({
        getRule: () => youtubeRule,
        logger: { error: (...values) => errors.push(values) },
    });
    const message = createMessage("texto", { deleteError: new Error("missing permissions") });

    const result = await runtime(message);

    assert.equal(result.handled, true);
    assert.equal(result.deleted, false);
    assert.equal(errors.length, 1);
});
