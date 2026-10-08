const test = require("node:test");
const assert = require("node:assert/strict");

const { CreateAutoCleanMessageRefresher } = require("../commands/autoCleanMessage/refresh.js");
const { CreateGhostMessageRefresher } = require("../commands/ghostMessage/refresh.js");

const factories = [
    ["Auto Clean", CreateAutoCleanMessageRefresher],
    ["Ghost Message", CreateGhostMessageRefresher],
];

for (const [name, factory] of factories) {
    test(`${name} refresh reacciona a create/update/status/delete y omite firmas iguales`, async () => {
        const signatures = [
            { count: 0, lastUpdatedAt: null },
            { count: 1, lastUpdatedAt: "2026-10-08T12:00:00.000Z" },
            { count: 1, lastUpdatedAt: "2026-10-08T12:00:01.000Z" },
            { count: 1, lastUpdatedAt: "2026-10-08T12:00:02.000Z" },
            { count: 1, lastUpdatedAt: "2026-10-08T12:00:03.000Z" },
            { count: 0, lastUpdatedAt: null },
        ];
        let index = 0;
        let reconciles = 0;
        const refresher = factory({
            getChangeSignature: async () => signatures[index],
            getEnabledConfigurations: async () => [],
            reconcile: async () => {
                reconciles += 1;
                return { found: 0, loaded: 0, failed: 0, diagnostics: [] };
            },
            logger: { error() {} },
        });

        for (index = 0; index < signatures.length; index += 1) {
            assert.equal((await refresher.refresh()).refreshed, true);
        }
        index = signatures.length - 1;
        assert.equal((await refresher.refresh()).reason, "unchanged");
        assert.equal(reconciles, signatures.length);
    });

    test(`${name} refresh evita reconciliaciones superpuestas`, async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const refresher = factory({
            getChangeSignature: async () => await gate,
            getEnabledConfigurations: async () => [],
            reconcile: async () => ({ found: 0, loaded: 0, failed: 0, diagnostics: [] }),
            logger: { error() {} },
        });
        const first = refresher.refresh();
        assert.equal((await refresher.refresh()).reason, "already-running");
        release({ count: 0, lastUpdatedAt: null });
        assert.equal((await first).refreshed, true);
    });
}
