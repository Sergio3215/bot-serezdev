const test = require("node:test");
const assert = require("node:assert/strict");

const { CreateRules } = require("../commands/rules.js");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const CreateCounterDb = (initialStates) => {
    const states = new Map(
        Object.entries(initialStates).map(([serverId, state]) => [serverId, { serverId, ...state }]),
    );
    const operations = [];

    return {
        states,
        operations,
        async GetById(serverId) {
            operations.push(`get:${serverId}`);
            await delay(5);
            const state = states.get(serverId);
            return state ? [{ ...state }] : [];
        },
        async Update(serverId, data) {
            operations.push(`update:${serverId}:${data.count}`);
            await delay(5);
            states.set(serverId, { ...states.get(serverId), ...data });
        },
    };
};

const CreateMessage = ({ guildId = "guild-1", channelId = "channel-1", authorId, content }) => {
    const reactions = [];
    const sent = [];
    let deleted = false;

    return {
        guild: { id: guildId },
        channel: {
            id: channelId,
            async send(message) {
                sent.push(message);
            },
        },
        author: { id: authorId, bot: false },
        content,
        reactions,
        sent,
        get deleted() {
            return deleted;
        },
        async react(emoji) {
            reactions.push(emoji);
        },
        async delete() {
            deleted = true;
        },
    };
};

const CreateProcessor = (db, rewards = []) => CreateRules({
    contadorCommand: db,
    lib: {
        async StreakCounter(msg, text) {
            rewards.push({ msg, text });
        },
    },
    logger: { error() {} },
});

test("una regla de canal rechazada no toca el contador ni altera el orden de la cola", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 0, modifiedBy: "" },
    });
    const rules = CreateProcessor(db);
    let releaseRejectedMessage;
    const rejectedMessage = new Promise((resolve) => {
        releaseRejectedMessage = resolve;
    });
    const blocked = CreateMessage({ authorId: "user-a", content: "texto" });
    const firstCount = CreateMessage({ authorId: "user-b", content: "1" });

    const blockedWork = rules(blocked, { shouldProcess: rejectedMessage });
    const countWork = rules(firstCount);
    releaseRejectedMessage(false);

    await Promise.all([blockedWork, countWork]);

    assert.deepEqual(db.operations, ["get:guild-1", "update:guild-1:1"]);
    assert.equal(db.states.get("guild-1").count, 1);
});

test("serializa lectura, validación y escritura para un mismo servidor/canal", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 0, modifiedBy: "" },
    });
    const rules = CreateProcessor(db);
    const one = CreateMessage({ authorId: "user-a", content: "1" });
    const two = CreateMessage({ authorId: "user-b", content: "2" });

    await Promise.all([rules(one), rules(two)]);

    assert.deepEqual(db.operations, [
        "get:guild-1",
        "update:guild-1:1",
        "get:guild-1",
        "update:guild-1:2",
    ]);
    assert.equal(db.states.get("guild-1").count, 2);
    assert.equal(db.states.get("guild-1").modifiedBy, "user-b");
    assert.deepEqual(one.reactions, ["✅"]);
    assert.deepEqual(two.reactions, ["✅"]);
});

test("procesa 1, 1, 2 en orden y resetea cada intento incorrecto", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 0, modifiedBy: "" },
    });
    const rules = CreateProcessor(db);
    const messages = [
        CreateMessage({ authorId: "user-a", content: "1" }),
        CreateMessage({ authorId: "user-b", content: "1" }),
        CreateMessage({ authorId: "user-c", content: "2" }),
    ];

    await Promise.all(messages.map(rules));

    assert.equal(db.states.get("guild-1").count, 0);
    assert.equal(db.states.get("guild-1").modifiedBy, "");
    assert.deepEqual(messages.map((message) => message.reactions), [["✅"], ["❌"], ["❌"]]);
});

test("un reset no puede ser sobrescrito por un handler que leyó el estado anterior", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 1, modifiedBy: "user-a" },
    });
    const rules = CreateProcessor(db);
    const breaker = CreateMessage({ authorId: "user-b", content: "9" });
    const staleCandidate = CreateMessage({ authorId: "user-c", content: "2" });

    await Promise.all([rules(breaker), rules(staleCandidate)]);

    assert.deepEqual(db.operations, [
        "get:guild-1",
        "update:guild-1:0",
        "get:guild-1",
        "update:guild-1:0",
    ]);
    assert.equal(db.states.get("guild-1").count, 0);
    assert.deepEqual(breaker.reactions, ["❌"]);
    assert.deepEqual(staleCandidate.reactions, ["❌"]);
});

test("la misma persona no puede contar dos veces seguidas", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 1, modifiedBy: "user-a" },
    });
    const rules = CreateProcessor(db);
    const message = CreateMessage({ authorId: "user-a", content: "2" });

    await rules(message);

    assert.equal(db.states.get("guild-1").count, 0);
    assert.equal(db.states.get("guild-1").modifiedBy, "");
    assert.deepEqual(message.reactions, ["❌"]);
    assert.match(message.sent[0], /dos veces seguidas/);
});

test("un fallo al reaccionar no revierte el estado ni bloquea la cola", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 0, modifiedBy: "" },
    });
    const rules = CreateProcessor(db);
    const one = CreateMessage({ authorId: "user-a", content: "1" });
    const two = CreateMessage({ authorId: "user-b", content: "2" });
    one.react = async () => {
        throw new Error("Discord no permitió reaccionar");
    };

    await Promise.all([rules(one), rules(two)]);

    assert.equal(db.states.get("guild-1").count, 2);
    assert.equal(db.states.get("guild-1").modifiedBy, "user-b");
    assert.deepEqual(two.reactions, ["✅"]);
});

test("un valor no entero también resetea la racha", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 7, modifiedBy: "user-a" },
    });
    const rules = CreateProcessor(db);
    const message = CreateMessage({ authorId: "user-b", content: "8abc" });

    await rules(message);

    assert.equal(db.states.get("guild-1").count, 0);
    assert.equal(db.states.get("guild-1").modifiedBy, "");
    assert.equal(message.deleted, true);
});

test("dos contadores distintos avanzan en paralelo", async () => {
    let releaseReads;
    const readGate = new Promise((resolve) => {
        releaseReads = resolve;
    });
    const started = [];
    const states = new Map([
        ["guild-1", { serverId: "guild-1", channelId: "channel-1", count: 0, modifiedBy: "" }],
        ["guild-2", { serverId: "guild-2", channelId: "channel-2", count: 0, modifiedBy: "" }],
    ]);
    const db = {
        async GetById(serverId) {
            started.push(serverId);
            await readGate;
            return [{ ...states.get(serverId) }];
        },
        async Update(serverId, data) {
            states.set(serverId, { ...states.get(serverId), ...data });
        },
    };
    const rules = CreateProcessor(db);

    const first = rules(CreateMessage({
        guildId: "guild-1",
        channelId: "channel-1",
        authorId: "user-a",
        content: "1",
    }));
    const second = rules(CreateMessage({
        guildId: "guild-2",
        channelId: "channel-2",
        authorId: "user-b",
        content: "1",
    }));

    await delay(0);
    assert.deepEqual(new Set(started), new Set(["guild-1", "guild-2"]));
    releaseReads();
    await Promise.all([first, second]);
});

test("desbloquea recompensas cada 20 números, también después de 300", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 319, modifiedBy: "user-a" },
    });
    const rewards = [];
    const rules = CreateProcessor(db, rewards);

    await rules(CreateMessage({ authorId: "user-b", content: "320" }));

    assert.equal(db.states.get("guild-1").count, 320);
    assert.equal(rewards.length, 1);
    assert.match(rewards[0].text, /320/);
});

test("desbloquea la primera recompensa exactamente al llegar a 20", async () => {
    const db = CreateCounterDb({
        "guild-1": { channelId: "channel-1", count: 19, modifiedBy: "user-a" },
    });
    const rewards = [];
    const rules = CreateProcessor(db, rewards);

    await rules(CreateMessage({ authorId: "user-b", content: "20" }));

    assert.equal(db.states.get("guild-1").count, 20);
    assert.equal(rewards.length, 1);
    assert.match(rewards[0].text, /20/);
});
