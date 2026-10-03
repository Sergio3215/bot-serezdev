const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CreateChannelRuleCache,
} = require("../commands/channelRules/cache.js");

const logger = { error() {} };

test("aísla las reglas por servidor y canal sin consultar DB al leer", async () => {
    let reads = 0;
    const records = [
        {
            id: "1",
            serverId: "server-a",
            channelId: "channel-1",
            type: "linkRestriction",
            allowedTypes: ["youtube"],
            mode: "contains",
            enabled: true,
        },
        {
            id: "2",
            serverId: "server-a",
            channelId: "channel-2",
            type: "linkRestriction",
            allowedTypes: ["x"],
            mode: "linksOnly",
            enabled: false,
        },
        {
            id: "3",
            serverId: "server-b",
            channelId: "channel-1",
            type: "linkRestriction",
            allowedTypes: ["instagram"],
            mode: "contains",
            enabled: true,
        },
    ];
    const cache = CreateChannelRuleCache({
        getChangeSignature: async () => ({
            count: records.length,
            lastUpdatedAt: "2026-10-03T12:00:00.000Z",
        }),
        getRules: async () => {
            reads += 1;
            return records;
        },
        logger,
    });

    await cache.refresh();

    assert.deepEqual(cache.get("server-a", "channel-1").allowedTypes, ["youtube"]);
    assert.deepEqual(cache.get("server-a", "channel-2").allowedTypes, ["x"]);
    assert.equal(cache.get("server-a", "channel-2").enabled, false);
    assert.deepEqual(cache.get("server-b", "channel-1").allowedTypes, ["instagram"]);
    assert.equal(cache.get("server-b", "channel-2"), null);

    cache.get("server-a", "channel-1");
    cache.get("server-a", "channel-1");
    assert.equal(reads, 1);

    const unchanged = await cache.refresh();
    assert.equal(unchanged.reason, "unchanged");
    assert.equal(reads, 1);
});

test("conserva el snapshot anterior si falla una recarga", async () => {
    let signature = {
        count: 1,
        lastUpdatedAt: "2026-10-03T12:00:00.000Z",
    };
    let fail = false;
    const cache = CreateChannelRuleCache({
        getChangeSignature: async () => signature,
        getRules: async () => {
            if (fail) throw new Error("database unavailable");
            return [{
                id: "1",
                serverId: "server-a",
                channelId: "channel-1",
                type: "linkRestriction",
                allowedTypes: ["youtube"],
                mode: "contains",
                enabled: true,
            }];
        },
        logger,
    });

    await cache.refresh();
    signature = {
        count: 2,
        lastUpdatedAt: "2026-10-03T12:00:01.000Z",
    };
    fail = true;

    const failed = await cache.refresh();

    assert.equal(failed.reason, "error");
    assert.deepEqual(cache.get("server-a", "channel-1").allowedTypes, ["youtube"]);
});
