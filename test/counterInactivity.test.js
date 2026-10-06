const test = require("node:test");
const assert = require("node:assert/strict");

const {
    DAY_IN_MILLISECONDS,
    INACTIVITY_MESSAGE,
    CreateCounterInactivityProcessor,
    StartCounterInactivityScheduler,
} = require("../commands/counter/inactivity.js");
const { ContadorCommand } = require("../db/index.js");

const NOW = new Date("2026-10-06T12:00:00.000Z");
const daysAgo = (days, extraMilliseconds = 0) => (
    new Date(NOW.getTime() - (days * DAY_IN_MILLISECONDS) + extraMilliseconds)
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

const CreateLogger = () => {
    const entries = [];
    return {
        entries,
        error(...args) { entries.push({ level: "error", args }); },
        warn(...args) { entries.push({ level: "warn", args }); },
    };
};

const CreateDb = (records, { beforeReset, failServers = [] } = {}) => {
    const states = new Map(records.map((record) => [record.serverId, { ...record }]));
    const resetCalls = [];

    return {
        states,
        resetCalls,
        async Get() {
            return [...states.values()].map((record) => ({ ...record }));
        },
        async ResetIfInactive(serverId, cutoff, resetAt) {
            resetCalls.push({ serverId, cutoff, resetAt });
            if (failServers.includes(serverId)) throw new Error(`DB failure: ${serverId}`);
            if (beforeReset) await beforeReset({ serverId, states, cutoff, resetAt });

            const current = states.get(serverId);
            if (!current || current.count <= 0 || current.modifiedOn > cutoff) return false;

            states.set(serverId, {
                ...current,
                count: 0,
                modifiedBy: "",
                modifiedOn: resetAt,
            });
            return true;
        },
    };
};

const CreateDiscord = ({
    serverId = "server-1",
    channelId = "channel-1",
    guildInCache = true,
    channelInCache = true,
    missingGuild = false,
    missingChannel = false,
    sendError = null,
} = {}) => {
    const sent = [];
    const channel = missingChannel ? null : {
        id: channelId,
        guildId: serverId,
        isTextBased: () => true,
        async send(message) {
            if (sendError) throw sendError;
            sent.push(message);
        },
    };
    const guild = missingGuild ? null : {
        id: serverId,
        channels: {
            cache: new Map(channelInCache && channel ? [[channelId, channel]] : []),
            async fetch(id) {
                return id === channelId ? channel : null;
            },
        },
    };
    const client = {
        guilds: {
            cache: new Map(guildInCache && guild ? [[serverId, guild]] : []),
            async fetch(id) {
                return id === serverId ? guild : null;
            },
        },
    };

    return { client, guild, channel, sent };
};

const ActiveCounter = (overrides = {}) => ({
    serverId: "server-1",
    channelId: "channel-1",
    count: 5,
    modifiedBy: "user-a",
    modifiedOn: daysAgo(31),
    ...overrides,
});

const CreateProcessor = (db, discord, logger = CreateLogger()) => ({
    logger,
    processor: CreateCounterInactivityProcessor({
        counterDb: db,
        client: discord.client,
        now: () => new Date(NOW),
        logger,
    }),
});

test("no expira antes de 30 días", async () => {
    const db = CreateDb([ActiveCounter({ modifiedOn: daysAgo(30, 1) })]);
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 0);
    assert.equal(db.resetCalls.length, 0);
    assert.equal(db.states.get("server-1").count, 5);
    assert.deepEqual(discord.sent, []);
});

test("expira exactamente a los 30 días y conserva channelId", async () => {
    const db = CreateDb([ActiveCounter({ modifiedOn: daysAgo(30) })]);
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();
    const state = db.states.get("server-1");

    assert.deepEqual(summary, { checked: 1, reset: 1, notified: 1, failed: 0 });
    assert.equal(state.count, 0);
    assert.equal(state.modifiedBy, "");
    assert.equal(state.channelId, "channel-1");
    assert.equal(state.modifiedOn.getTime(), NOW.getTime());
    assert.deepEqual(discord.sent, [INACTIVITY_MESSAGE]);
});

test("expira después de más de 30 días usando fetch fallback", async () => {
    const db = CreateDb([ActiveCounter()]);
    const discord = CreateDiscord({ guildInCache: false, channelInCache: false });
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 1);
    assert.equal(summary.notified, 1);
});

test("un canal eliminado no impide persistir el reset", async () => {
    const db = CreateDb([ActiveCounter()]);
    const discord = CreateDiscord({ missingChannel: true });
    const { processor, logger } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(db.states.get("server-1").count, 0);
    assert.equal(summary.notified, 0);
    assert.equal(logger.entries.at(-1).level, "warn");
});

test("un guild inexistente no impide persistir el reset", async () => {
    const db = CreateDb([ActiveCounter()]);
    const discord = CreateDiscord({ missingGuild: true });
    const { processor, logger } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(db.states.get("server-1").count, 0);
    assert.equal(summary.notified, 0);
    assert.match(logger.entries.at(-1).args[0], /servidor/i);
});

test("un fallo de permisos al enviar no revierte el reset", async () => {
    const db = CreateDb([ActiveCounter()]);
    const discord = CreateDiscord({ sendError: new Error("Missing Permissions") });
    const { processor, logger } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(db.states.get("server-1").count, 0);
    assert.equal(summary.notified, 0);
    assert.match(logger.entries.at(-1).args[0], /notificar/i);
});

test("un servidor roto no impide procesar los siguientes", async () => {
    const db = CreateDb([
        ActiveCounter({ serverId: "server-a", channelId: "channel-a" }),
        ActiveCounter({ serverId: "server-b", channelId: "channel-b" }),
    ], { failServers: ["server-a"] });
    const discordA = CreateDiscord({ serverId: "server-a", channelId: "channel-a" });
    const discordB = CreateDiscord({ serverId: "server-b", channelId: "channel-b" });
    const client = discordA.client;
    client.guilds.cache.set("server-b", discordB.guild);
    const logger = CreateLogger();
    const processor = CreateCounterInactivityProcessor({
        counterDb: db,
        client,
        now: () => new Date(NOW),
        logger,
    });

    const summary = await processor.run();

    assert.equal(summary.failed, 1);
    assert.equal(db.states.get("server-a").count, 5);
    assert.equal(db.states.get("server-b").count, 0);
    assert.deepEqual(discordB.sent, [INACTIVITY_MESSAGE]);
});

test("un canal eliminado en server A no impide resetear y notificar server B", async () => {
    const db = CreateDb([
        ActiveCounter({ serverId: "server-a", channelId: "channel-a" }),
        ActiveCounter({ serverId: "server-b", channelId: "channel-b" }),
    ]);
    const discordA = CreateDiscord({
        serverId: "server-a",
        channelId: "channel-a",
        missingChannel: true,
    });
    const discordB = CreateDiscord({ serverId: "server-b", channelId: "channel-b" });
    const client = discordA.client;
    client.guilds.cache.set("server-b", discordB.guild);
    const logger = CreateLogger();
    const processor = CreateCounterInactivityProcessor({
        counterDb: db,
        client,
        now: () => new Date(NOW),
        logger,
    });

    const summary = await processor.run();

    assert.deepEqual(summary, { checked: 2, reset: 2, notified: 1, failed: 0 });
    assert.equal(db.states.get("server-a").count, 0);
    assert.equal(db.states.get("server-b").count, 0);
    assert.deepEqual(discordB.sent, [INACTIVITY_MESSAGE]);
});

test("un fallo de Get se propaga para que el scheduler lo controle", async () => {
    const logger = CreateLogger();
    const processor = CreateCounterInactivityProcessor({
        counterDb: {
            async Get() { throw new Error("database unavailable"); },
            async ResetIfInactive() { return false; },
        },
        client: CreateDiscord().client,
        now: () => new Date(NOW),
        logger,
    });

    await assert.rejects(processor.run(), /database unavailable/);
});

test("el scheduler captura rechazos del job sin Promise abandonada", async () => {
    let scheduledCallback;
    const logger = CreateLogger();
    const timer = StartCounterInactivityScheduler({
        async run() { throw new Error("Get failed"); },
        logger,
        setIntervalFn(callback, milliseconds) {
            scheduledCallback = callback;
            return { milliseconds };
        },
    });

    scheduledCallback();
    await flush();

    assert.equal(timer.milliseconds, DAY_IN_MILLISECONDS);
    assert.equal(logger.entries.length, 1);
    assert.match(logger.entries[0].args[0], /job de inactividad/i);
});

test("run espera a que termine el reset antes de resolver", async () => {
    let releaseReset;
    let settled = false;
    const gate = new Promise((resolve) => { releaseReset = resolve; });
    const db = CreateDb([ActiveCounter()], {
        async beforeReset() { await gate; },
    });
    const { processor } = CreateProcessor(db, CreateDiscord());

    const work = processor.run().then(() => { settled = true; });
    await flush();
    assert.equal(settled, false);

    releaseReset();
    await work;
    assert.equal(settled, true);
});

test("el ciclo siguiente al reset no vuelve a avisar", async () => {
    const db = CreateDb([ActiveCounter()]);
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    await processor.run();
    await processor.run();

    assert.equal(db.resetCalls.length, 1);
    assert.deepEqual(discord.sent, [INACTIVITY_MESSAGE]);
});

test("un contador vencido ya en cero no anuncia una racha inexistente", async () => {
    const db = CreateDb([ActiveCounter({ count: 0, modifiedBy: "" })]);
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 0);
    assert.equal(db.resetCalls.length, 0);
    assert.deepEqual(discord.sent, []);
});

test("actividad nueva durante el job no es sobrescrita por un reset stale", async () => {
    const db = CreateDb([ActiveCounter()], {
        beforeReset({ states, serverId }) {
            states.set(serverId, {
                ...states.get(serverId),
                count: 6,
                modifiedBy: "user-b",
                modifiedOn: new Date(NOW),
            });
        },
    });
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 0);
    assert.equal(db.states.get("server-1").count, 6);
    assert.equal(db.states.get("server-1").modifiedBy, "user-b");
    assert.deepEqual(discord.sent, []);
});

test("un cambio de channelId concurrente no es revertido por el job", async () => {
    const db = CreateDb([ActiveCounter()], {
        beforeReset({ states, serverId }) {
            states.set(serverId, {
                ...states.get(serverId),
                channelId: "channel-new",
                modifiedOn: new Date(NOW),
            });
        },
    });
    const discord = CreateDiscord();
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 0);
    assert.equal(db.states.get("server-1").channelId, "channel-new");
    assert.deepEqual(discord.sent, []);
});

test("un reset condicional de cero registros no envía notificación", async () => {
    const counter = ActiveCounter();
    const discord = CreateDiscord();
    const db = {
        async Get() { return [{ ...counter }]; },
        async ResetIfInactive() { return false; },
    };
    const { processor } = CreateProcessor(db, discord);

    const summary = await processor.run();

    assert.equal(summary.reset, 0);
    assert.equal(summary.notified, 0);
    assert.deepEqual(discord.sent, []);
});

test("ContadorCommand usa updateMany atómico sin escribir channelId", async () => {
    let input;
    const counterDb = new ContadorCommand({
        client: {
            ContadorCommand: {
                async updateMany(args) {
                    input = args;
                    return { count: 1 };
                },
            },
        },
    });
    const cutoff = daysAgo(30);
    const result = await counterDb.ResetIfInactive("server-1", cutoff, NOW);

    assert.equal(result, true);
    assert.deepEqual(input.where, {
        serverId: "server-1",
        count: { gt: 0 },
        modifiedOn: { lte: cutoff },
    });
    assert.deepEqual(input.data, {
        count: 0,
        modifiedBy: "",
        modifiedOn: NOW,
    });
    assert.equal(Object.hasOwn(input.data, "channelId"), false);
});
