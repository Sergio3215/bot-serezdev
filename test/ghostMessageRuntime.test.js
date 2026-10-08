const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CreateGhostMessageRuntime,
    StartGhostMessageSweeper,
    GHOST_SWEEP_INTERVAL_MS,
} = require("../commands/ghostMessage/runtime.js");

const NOW = new Date("2026-10-08T12:00:00.000Z");
const Configuration = (overrides = {}) => ({
    id: "ghost-1",
    serverId: "111111111111111111",
    channelId: "222222222222222222",
    lifetimeValue: 1.25,
    lifetimeUnit: "hours",
    enabled: true,
    ...overrides,
});
const SilentLogger = () => ({ log() {}, error() {}, warn() {} });

test("Ghost calcula cutoff exacto y expira en el borde inclusive", async () => {
    let invocation;
    const runtime = CreateGhostMessageRuntime({
        now: () => new Date(NOW),
        logger: SilentLogger(),
        deleteMessages: async (options) => { invocation = options; return {}; },
    });
    await runtime.reconcile([Configuration()]);
    const result = await runtime.runSweep();
    const expected = NOW.getTime() - 75 * 60 * 1000;
    assert.equal(result.succeeded, 1);
    assert.equal(invocation.cutoff.getTime(), expected);
    assert.equal(invocation.shouldDelete({ createdTimestamp: expected + 1 }), false);
    assert.equal(invocation.shouldDelete({ createdTimestamp: expected }), true);
    assert.equal(invocation.shouldDelete({ createdTimestamp: expected - 1 }), true);
});

test("Ghost no procesa disabled", async () => {
    let calls = 0;
    const runtime = CreateGhostMessageRuntime({
        deleteMessages: async () => { calls += 1; },
        logger: SilentLogger(),
    });
    const summary = await runtime.reconcile([Configuration({ enabled: false })]);
    await runtime.runSweep();
    assert.equal(summary.loaded, 0);
    assert.equal(calls, 0);
});

test("Ghost aísla fallos y evita concurrencia duplicada", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const processed = [];
    const runtime = CreateGhostMessageRuntime({
        now: () => new Date(NOW),
        logger: SilentLogger(),
        deleteMessages: async ({ channelId }) => {
            if (channelId === "222222222222222222") throw new Error("missing channel");
            if (channelId === "333333333333333333") await gate;
            processed.push(channelId);
            return {};
        },
    });
    const concurrent = Configuration({ id: "ghost-concurrent", channelId: "333333333333333333" });
    const first = runtime.processConfiguration(concurrent, NOW);
    const duplicate = await runtime.processConfiguration(concurrent, NOW);
    assert.equal(duplicate.reason, "already-running");
    release();
    await first;

    await runtime.reconcile([
        Configuration(),
        Configuration({ id: "ghost-2", channelId: "444444444444444444" }),
    ]);
    const result = await runtime.runSweep();
    assert.equal(result.failed, 1);
    assert.equal(result.succeeded, 1);
    assert.ok(processed.includes("444444444444444444"));
});

test("Ghost usa un único intervalo central, sin timers por mensaje", () => {
    let intervals = 0;
    let milliseconds;
    const sweeper = StartGhostMessageSweeper({
        runSweep: async () => {},
        setIntervalFn(callback, value) {
            intervals += 1;
            milliseconds = value;
            return { callback };
        },
        clearIntervalFn() {},
    });
    sweeper.start();
    sweeper.start();
    assert.equal(intervals, 1);
    assert.equal(milliseconds, GHOST_SWEEP_INTERVAL_MS);
});
