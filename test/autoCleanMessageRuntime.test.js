const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CreateAutoCleanMessageRuntime,
    StartAutoCleanMessageScheduler,
} = require("../commands/autoCleanMessage/runtime.js");

const SERVER_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";
const BASE_NOW = new Date("2026-10-08T12:00:00.000Z");

const Configuration = (overrides = {}) => ({
    id: "auto-1",
    serverId: SERVER_ID,
    channelId: CHANNEL_ID,
    frequencyValue: 0.25,
    frequencyUnit: "hours",
    enabled: true,
    nextRunAt: new Date(BASE_NOW.getTime() - 60_000),
    ...overrides,
});

const CreateRepository = () => ({
    successes: [],
    retries: [],
    async RecordSuccess(...args) { this.successes.push(args); return true; },
    async RecordRetry(...args) { this.retries.push(args); return true; },
});

const SilentLogger = () => ({ log() {}, error() {}, warn() {} });

test("Auto Clean no ejecuta antes de nextRunAt y ejecuta al llegar", async () => {
    let deletes = 0;
    const repository = CreateRepository();
    const runtime = CreateAutoCleanMessageRuntime({
        repository,
        now: () => new Date(BASE_NOW),
        deleteMessages: async () => { deletes += 1; return { deleted: 2 }; },
        logger: SilentLogger(),
    });
    await runtime.reconcile([Configuration({ nextRunAt: new Date(BASE_NOW.getTime() + 1) })]);
    assert.equal((await runtime.runDue()).due, 0);
    assert.equal(deletes, 0);

    await runtime.reconcile([Configuration({ nextRunAt: new Date(BASE_NOW) })]);
    const result = await runtime.runDue();
    assert.equal(result.succeeded, 1);
    assert.equal(deletes, 1);
});

test("Auto Clean ignora disabled y no ejecuta intervalos perdidos en cadena", async () => {
    let deletes = 0;
    const runtime = CreateAutoCleanMessageRuntime({
        repository: CreateRepository(),
        now: () => new Date(BASE_NOW),
        deleteMessages: async () => { deletes += 1; return {}; },
        logger: SilentLogger(),
    });
    const disabled = await runtime.reconcile([Configuration({ enabled: false })]);
    assert.equal(disabled.loaded, 0);
    await runtime.runDue();
    assert.equal(deletes, 0);

    await runtime.reconcile([Configuration({ nextRunAt: new Date("2026-01-01T00:00:00.000Z") })]);
    await runtime.runDue();
    await runtime.runDue();
    assert.equal(deletes, 1);
});

test("Auto Clean programa la próxima ejecución desde la finalización", async () => {
    const repository = CreateRepository();
    let current = new Date(BASE_NOW);
    const runtime = CreateAutoCleanMessageRuntime({
        repository,
        now: () => new Date(current),
        deleteMessages: async () => {
            current = new Date(BASE_NOW.getTime() + 30_000);
            return {};
        },
        logger: SilentLogger(),
    });
    await runtime.reconcile([Configuration()]);
    await runtime.runDue();
    const [, , completedAt, nextRunAt] = repository.successes[0];
    assert.equal(completedAt.getTime(), current.getTime());
    assert.equal(nextRunAt.getTime(), current.getTime() + 15 * 60 * 1000);
});

test("Auto Clean evita dos ejecuciones concurrentes de la misma configuración", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let deletes = 0;
    const runtime = CreateAutoCleanMessageRuntime({
        repository: CreateRepository(),
        now: () => new Date(BASE_NOW),
        deleteMessages: async () => { deletes += 1; await gate; return {}; },
        logger: SilentLogger(),
    });
    const configuration = Object.freeze(Configuration());
    const first = runtime.processConfiguration(configuration);
    const second = await runtime.processConfiguration(configuration);
    assert.equal(second.reason, "already-running");
    assert.equal(deletes, 1);
    release();
    await first;
});

test("Auto Clean no queda vencido si refresh reconcilia durante la ejecución", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let deletes = 0;
    const runtime = CreateAutoCleanMessageRuntime({
        repository: CreateRepository(),
        now: () => new Date(BASE_NOW),
        deleteMessages: async () => { deletes += 1; await gate; return {}; },
        logger: SilentLogger(),
    });
    await runtime.reconcile([Configuration()]);
    const execution = runtime.runDue();
    await new Promise((resolve) => setImmediate(resolve));
    await runtime.reconcile([Configuration()]);
    release();
    await execution;
    await runtime.runDue();
    assert.equal(deletes, 1);
});

test("Auto Clean reconstruye estado persistido después de un reinicio", async () => {
    let deletes = 0;
    let persisted = Configuration();
    const repository = {
        async RecordSuccess(id, expected, completedAt, nextRunAt) {
            persisted = { ...persisted, lastRunAt: completedAt, nextRunAt };
            return true;
        },
        async RecordRetry() { return true; },
    };
    for (let restart = 0; restart < 2; restart += 1) {
        const runtime = CreateAutoCleanMessageRuntime({
            repository,
            now: () => new Date(BASE_NOW),
            deleteMessages: async () => { deletes += 1; return {}; },
            logger: SilentLogger(),
        });
        await runtime.reconcile([persisted]);
        await runtime.runDue();
    }
    assert.equal(deletes, 1);
});

test("un error de canal o permisos no detiene otras configuraciones", async () => {
    const processed = [];
    const runtime = CreateAutoCleanMessageRuntime({
        repository: CreateRepository(),
        now: () => new Date(BASE_NOW),
        deleteMessages: async ({ channelId }) => {
            if (channelId === CHANNEL_ID) throw new Error("Missing Permissions / unknown channel");
            processed.push(channelId);
            return {};
        },
        logger: SilentLogger(),
    });
    await runtime.reconcile([
        Configuration(),
        Configuration({ id: "auto-2", channelId: "333333333333333333" }),
    ]);
    const result = await runtime.runDue();
    assert.equal(result.failed, 1);
    assert.equal(result.succeeded, 1);
    assert.deepEqual(processed, ["333333333333333333"]);
});

test("el scheduler no duplica intervalos y captura rechazos", async () => {
    let callback;
    let intervals = 0;
    let cleared = 0;
    const scheduler = StartAutoCleanMessageScheduler({
        async runDue() { throw new Error("db down"); },
        logger: SilentLogger(),
        setIntervalFn(fn) { intervals += 1; callback = fn; return { id: 1 }; },
        clearIntervalFn() { cleared += 1; },
    });
    assert.equal(scheduler.start(), scheduler.start());
    callback();
    await new Promise((resolve) => setImmediate(resolve));
    scheduler.stop();
    assert.equal(intervals, 1);
    assert.equal(cleared, 1);
});
