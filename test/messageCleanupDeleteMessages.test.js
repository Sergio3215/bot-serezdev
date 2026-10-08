const test = require("node:test");
const assert = require("node:assert/strict");

const {
    DeleteChannelMessages,
    MessageCleanupError,
} = require("../commands/messageCleanup/deleteMessages.js");

const NOW = new Date("2026-10-08T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const Message = (id, ageMs, overrides = {}) => ({
    id,
    pinned: false,
    createdTimestamp: NOW.getTime() - ageMs,
    async delete() {},
    ...overrides,
});

const CreateDiscord = ({ pages, bulkDelete, permissions = true }) => {
    const fetches = [];
    const channel = {
        id: "channel-1",
        guildId: "server-1",
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => permissions }),
        messages: {
            async fetch(options) {
                fetches.push(options);
                const page = pages.shift() ?? [];
                return new Map(page.map((message) => [message.id, message]));
            },
        },
        async bulkDelete(ids, filterOld) {
            if (bulkDelete) return await bulkDelete(ids, filterOld);
            return new Map(ids.map((id) => [id, {}]));
        },
    };
    const guild = {
        members: { me: { id: "bot" } },
        channels: { cache: new Map([[channel.id, channel]]) },
    };
    const client = { guilds: { cache: new Map([["server-1", guild]]) } };
    return { client, channel, fetches };
};

const Run = (discord, overrides = {}) => DeleteChannelMessages({
    client: discord.client,
    serverId: "server-1",
    channelId: "channel-1",
    now: () => new Date(NOW),
    logger: { error() {} },
    ...overrides,
});

test("message cleanup preserva pinned, usa bulk para recientes e individual para antiguos", async () => {
    let oldDeletes = 0;
    const pinned = Message("pinned", DAY, { pinned: true });
    const recent = Message("recent", DAY);
    const old = Message("old", 20 * DAY, { async delete() { oldDeletes += 1; } });
    const discord = CreateDiscord({ pages: [[pinned, recent, old]] });

    const summary = await Run(discord);

    assert.equal(summary.pinned, 1);
    assert.equal(summary.eligible, 2);
    assert.equal(summary.deleted, 2);
    assert.equal(oldDeletes, 1);
});

test("message cleanup pagina con before y respeta el límite por ciclo", async () => {
    const discord = CreateDiscord({
        pages: [
            [Message("3", DAY), Message("2", DAY)],
            [Message("1", DAY)],
        ],
    });
    const summary = await Run(discord, { pageSize: 2, maxMessages: 3 });

    assert.equal(summary.pages, 2);
    assert.equal(summary.fetched, 3);
    assert.equal(summary.limitReached, true);
    assert.equal(discord.fetches[1].before, "2");
});

test("message cleanup no procesa historial ilimitado", async () => {
    const discord = CreateDiscord({ pages: [[Message("2", DAY), Message("1", DAY)]] });
    const summary = await Run(discord, { pageSize: 2, maxMessages: 2 });
    assert.equal(discord.fetches.length, 1);
    assert.equal(summary.fetched, 2);
});

test("message cleanup tolera errores parciales sin rejection abandonada", async () => {
    const loggerEntries = [];
    const recent = Message("recent", DAY);
    const old = Message("old", 20 * DAY, { async delete() { throw new Error("old failed"); } });
    const discord = CreateDiscord({
        pages: [[recent, old]],
        async bulkDelete() { throw new Error("bulk failed"); },
    });
    const summary = await Run(discord, {
        logger: { error(...args) { loggerEntries.push(args); } },
    });
    assert.equal(summary.deleted, 0);
    assert.equal(summary.failed, 2);
    assert.equal(loggerEntries.length, 2);
});

test("message cleanup usa cutoff como cursor y conserva mensajes nuevos", async () => {
    const cutoff = new Date(NOW.getTime() - 2 * DAY);
    const expired = Message("expired", 3 * DAY);
    const fresh = Message("fresh", DAY);
    const discord = CreateDiscord({ pages: [[fresh, expired]] });
    const summary = await Run(discord, { cutoff });
    assert.equal(typeof discord.fetches[0].before, "string");
    assert.equal(summary.eligible, 1);
    assert.equal(summary.deleted, 1);
});

test("message cleanup reporta permisos insuficientes de forma controlada", async () => {
    const discord = CreateDiscord({ pages: [], permissions: false });
    await assert.rejects(
        Run(discord),
        (error) => error instanceof MessageCleanupError && error.code === "MISSING_PERMISSIONS",
    );
});
