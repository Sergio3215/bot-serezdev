const test = require("node:test");
const assert = require("node:assert/strict");

const {
    BuildScheduledTaskCronExpression,
    CreateScheduledTaskJob,
    ExecuteScheduledTask,
    NormalizeScheduledTaskForRuntime,
} = require("../commands/scheduledTasks/runner.js");
const {
    CreateScheduledTaskRegistry,
} = require("../commands/scheduledTasks/index.js");
const {
    CreateScheduledTaskRefresher,
} = require("../commands/scheduledTasks/refresh.js");

const SERVER_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";

const createTask = (overrides = {}) => ({
    id: "task-1",
    serverId: SERVER_ID,
    name: "Aviso",
    channelId: CHANNEL_ID,
    content: "Mensaje",
    scheduleType: "daily",
    time: "18:30",
    weekdays: [],
    timezone: "America/Argentina/Buenos_Aires",
    enabled: true,
    updatedAt: "2026-10-04T12:00:00.000Z",
    ...overrides,
});

class FakeCronJob {
    static instances = [];

    constructor(expression, onTick, onComplete, startNow, timezone) {
        this.expression = expression;
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.startNow = startNow;
        this.timezone = timezone;
        this.starts = 0;
        this.stops = 0;
        FakeCronJob.instances.push(this);
    }

    start() {
        this.starts += 1;
    }

    stop() {
        this.stops += 1;
    }
}

const createLogger = () => ({
    logs: [],
    errors: [],
    log(...args) {
        this.logs.push(args);
    },
    error(...args) {
        this.errors.push(args);
    },
});

test("genera expresiones cron daily y weekly con timezone", () => {
    const daily = NormalizeScheduledTaskForRuntime(createTask());
    const weekly = NormalizeScheduledTaskForRuntime(createTask({
        scheduleType: "weekly",
        weekdays: [5, 1, 3],
        time: "07:05",
    }));

    assert.equal(BuildScheduledTaskCronExpression(daily), "0 30 18 * * *");
    assert.equal(BuildScheduledTaskCronExpression(weekly), "0 5 7 * * 1,3,5");

    FakeCronJob.instances = [];
    const created = CreateScheduledTaskJob({
        client: {},
        task: createTask(),
        CronJobClass: FakeCronJob,
    });
    assert.equal(created.job.startNow, false);
    assert.equal(created.job.timezone, "America/Argentina/Buenos_Aires");

    const realJob = CreateScheduledTaskJob({
        client: {},
        task: createTask({ scheduleType: "weekly", weekdays: [1, 3, 5] }),
    });
    assert.equal(realJob.job.isActive, false);
    realJob.job.stop();
});

test("runtime resuelve cache y fallback fetch y envía contenido", async () => {
    const payloads = [];
    const cachedChannel = {
        isTextBased: () => true,
        isSendable: () => true,
        async send(payload) {
            payloads.push(payload);
        },
    };
    const cachedGuild = {
        channels: { cache: new Map([[CHANNEL_ID, cachedChannel]]) },
    };
    const cachedClient = {
        guilds: { cache: new Map([[SERVER_ID, cachedGuild]]) },
    };

    assert.equal(await ExecuteScheduledTask(cachedClient, createTask()), true);
    assert.deepEqual(payloads, [{ content: "Mensaje" }]);

    let guildFetches = 0;
    let channelFetches = 0;
    const fetchedClient = {
        guilds: {
            cache: new Map(),
            async fetch() {
                guildFetches += 1;
                return {
                    channels: {
                        cache: new Map(),
                        async fetch() {
                            channelFetches += 1;
                            return cachedChannel;
                        },
                    },
                };
            },
        },
    };

    assert.equal(await ExecuteScheduledTask(fetchedClient, createTask()), true);
    assert.equal(guildFetches, 1);
    assert.equal(channelFetches, 1);
});

test("dos tareas de servidores distintos se ejecutan de forma independiente", async () => {
    const OTHER_SERVER_ID = "333333333333333333";
    const OTHER_CHANNEL_ID = "444444444444444444";
    let releaseFirst;
    const firstPending = new Promise((resolve) => {
        releaseFirst = resolve;
    });
    let secondSent = false;

    const client = {
        guilds: {
            cache: new Map([
                [SERVER_ID, {
                    channels: {
                        cache: new Map([[CHANNEL_ID, {
                            async send() {
                                await firstPending;
                            },
                        }]]),
                    },
                }],
                [OTHER_SERVER_ID, {
                    channels: {
                        cache: new Map([[OTHER_CHANNEL_ID, {
                            async send() {
                                secondSent = true;
                            },
                        }]]),
                    },
                }],
            ]),
        },
    };

    const firstExecution = ExecuteScheduledTask(client, createTask());
    const secondResult = await ExecuteScheduledTask(client, createTask({
        id: "task-2",
        serverId: OTHER_SERVER_ID,
        channelId: OTHER_CHANNEL_ID,
    }));

    assert.equal(secondResult, true);
    assert.equal(secondSent, true);
    releaseFirst();
    assert.equal(await firstExecution, true);
});

test("errores de guild, canal o permisos quedan aislados", async () => {
    const logger = createLogger();
    const missingGuildClient = {
        guilds: {
            cache: new Map(),
            async fetch() {
                throw new Error("Unknown Guild");
            },
        },
    };
    assert.equal(
        await ExecuteScheduledTask(missingGuildClient, createTask(), logger),
        false,
    );

    const deniedChannel = {
        isTextBased: () => true,
        isSendable: () => true,
        async send() {
            throw new Error("Missing Permissions");
        },
    };
    const deniedClient = {
        guilds: {
            cache: new Map([[SERVER_ID, {
                channels: { cache: new Map([[CHANNEL_ID, deniedChannel]]) },
            }]]),
        },
    };
    assert.equal(await ExecuteScheduledTask(deniedClient, createTask(), logger), false);

    const invalidChannelClient = {
        guilds: {
            cache: new Map([[SERVER_ID, {
                channels: {
                    cache: new Map([[CHANNEL_ID, {
                        isTextBased: () => false,
                        async send() {},
                    }]]),
                },
            }]]),
        },
    };
    assert.equal(
        await ExecuteScheduledTask(invalidChannelClient, createTask(), logger),
        false,
    );
    assert.equal(logger.errors.length, 3);
});

test("registry reutiliza, reemplaza, detiene y no duplica jobs", async () => {
    FakeCronJob.instances = [];
    let tasks = [
        createTask(),
        createTask({
            id: "task-2",
            channelId: "333333333333333333",
            time: "19:00",
        }),
    ];
    const registry = CreateScheduledTaskRegistry({
        client: {},
        getEnabledTasks: async () => tasks,
        CronJobClass: FakeCronJob,
        logger: createLogger(),
    });

    const initial = await registry.reconcileScheduledTasks();
    assert.equal(initial.loaded, 2);
    assert.equal(initial.started, 2);
    assert.equal(registry.GetScheduledTaskCount(), 2);
    assert.equal(FakeCronJob.instances.length, 2);

    const firstJob = registry.GetScheduledTaskEntry("task-1").job;
    const secondJob = registry.GetScheduledTaskEntry("task-2").job;
    const unchanged = await registry.reconcileScheduledTasks();
    assert.equal(unchanged.reused, 2);
    assert.equal(unchanged.started, 0);
    assert.equal(FakeCronJob.instances.length, 2);

    tasks = [createTask({
        content: "Mensaje actualizado",
        updatedAt: "2026-10-04T12:01:00.000Z",
    })];
    const changed = await registry.reconcileScheduledTasks();
    assert.equal(changed.loaded, 1);
    assert.equal(changed.replaced, 1);
    assert.equal(changed.stopped, 2);
    assert.equal(changed.started, 1);
    assert.equal(firstJob.stops, 1);
    assert.equal(secondJob.stops, 1);
    assert.notEqual(registry.GetScheduledTaskEntry("task-1").job, firstJob);

    const replacement = registry.GetScheduledTaskEntry("task-1").job;
    tasks = [];
    const disabledOrDeleted = await registry.reconcileScheduledTasks();
    assert.equal(disabledOrDeleted.loaded, 0);
    assert.equal(disabledOrDeleted.stopped, 1);
    assert.equal(replacement.stops, 1);
});

test("una tarea inválida no impide cargar las demás", async () => {
    FakeCronJob.instances = [];
    const registry = CreateScheduledTaskRegistry({
        client: {},
        getEnabledTasks: async () => [
            createTask(),
            createTask({ id: "invalid", time: "99:99" }),
            createTask({ id: "disabled", enabled: false }),
        ],
        CronJobClass: FakeCronJob,
        logger: createLogger(),
    });

    const summary = await registry.reconcileScheduledTasks();
    assert.equal(summary.found, 3);
    assert.equal(summary.loaded, 1);
    assert.equal(summary.failed, 2);
    assert.equal(registry.GetScheduledTaskCount(), 1);
});

test("refresher evita recargas iguales y conserva firma ante error", async () => {
    const logger = createLogger();
    let signature = {
        count: 1,
        lastUpdatedAt: "2026-10-04T12:00:00.000Z",
    };
    let reconciles = 0;
    let failNext = false;
    const refresher = CreateScheduledTaskRefresher({
        getChangeSignature: async () => signature,
        reconcileScheduledTasks: async () => {
            reconciles += 1;
            if (failNext) {
                failNext = false;
                throw new Error("Database unavailable");
            }
            return {
                found: 1,
                loaded: 1,
                failed: 0,
                diagnostics: [],
            };
        },
        logger,
    });

    assert.equal((await refresher.refreshScheduledTasks()).refreshed, true);
    assert.equal((await refresher.refreshScheduledTasks()).reason, "unchanged");
    assert.equal(reconciles, 1);

    const applied = refresher.GetLastAppliedSignature();
    signature = {
        count: 2,
        lastUpdatedAt: "2026-10-04T12:01:00.000Z",
    };
    failNext = true;
    assert.equal((await refresher.refreshScheduledTasks()).reason, "error");
    assert.deepEqual(refresher.GetLastAppliedSignature(), applied);
    assert.equal((await refresher.refreshScheduledTasks()).refreshed, true);
    assert.deepEqual(refresher.GetLastAppliedSignature(), signature);
});

test("refresher omite una segunda pasada concurrente", async () => {
    let release;
    const pending = new Promise((resolve) => {
        release = resolve;
    });
    let reconciles = 0;
    const refresher = CreateScheduledTaskRefresher({
        getChangeSignature: async () => pending,
        reconcileScheduledTasks: async () => {
            reconciles += 1;
            return { found: 0, loaded: 0, failed: 0, diagnostics: [] };
        },
        logger: createLogger(),
    });

    const first = refresher.refreshScheduledTasks();
    assert.equal((await refresher.refreshScheduledTasks()).reason, "already-running");
    release({ count: 0, lastUpdatedAt: null });
    assert.equal((await first).refreshed, true);
    assert.equal(reconciles, 1);
});
