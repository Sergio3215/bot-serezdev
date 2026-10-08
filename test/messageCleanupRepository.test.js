const test = require("node:test");
const assert = require("node:assert/strict");

const { AutoCleanMessageRepository } = require("../commands/autoCleanMessage/repository.js");
const { GhostMessageRepository } = require("../commands/ghostMessage/repository.js");

const NOW = new Date("2026-10-08T12:00:00.000Z");

test("Auto Clean crea con nextRunAt y recalcula al editar frecuencia", async () => {
    const writes = [];
    let current = {
        id: "auto-1",
        serverId: "111111111111111111",
        channelId: "222222222222222222",
        frequencyValue: 1,
        frequencyUnit: "hours",
        enabled: true,
        nextRunAt: new Date("2026-10-08T13:00:00.000Z"),
    };
    const client = {
        autoCleanMessage: {
            async create(args) { writes.push(args); return args.data; },
            async findUnique() { return current; },
            async update(args) { writes.push(args); current = { ...current, ...args.data }; return current; },
        },
    };
    const repository = new AutoCleanMessageRepository({ client, now: () => new Date(NOW) });
    await repository.Create({
        serverId: current.serverId,
        channelId: current.channelId,
        frequencyValue: 0.25,
        frequencyUnit: "hours",
    });
    assert.equal(writes[0].data.nextRunAt.toISOString(), "2026-10-08T12:15:00.000Z");

    await repository.Update("auto-1", {
        serverId: current.serverId,
        channelId: current.channelId,
        frequencyValue: 2.5,
        frequencyUnit: "hours",
    });
    assert.equal(writes[1].data.nextRunAt.toISOString(), "2026-10-08T14:30:00.000Z");
});

test("Auto Clean reactivar recalcula nextRunAt; desactivar no lo hace", async () => {
    const writes = [];
    let current = {
        id: "auto-1",
        frequencyValue: 2,
        frequencyUnit: "days",
        enabled: true,
        nextRunAt: new Date("2026-10-10T12:00:00.000Z"),
    };
    const client = {
        autoCleanMessage: {
            async findUnique() { return current; },
            async update(args) { writes.push(args); current = { ...current, ...args.data }; return current; },
        },
    };
    const repository = new AutoCleanMessageRepository({ client, now: () => new Date(NOW) });
    await repository.UpdateStatus("auto-1", false);
    assert.deepEqual(writes[0].data, { enabled: false });
    await repository.UpdateStatus("auto-1", true);
    assert.equal(writes[1].data.enabled, true);
    assert.equal(writes[1].data.nextRunAt.toISOString(), "2026-10-10T12:00:00.000Z");
});

test("Auto Clean actualiza el estado de ejecución condicionalmente", async () => {
    const operations = [];
    const repository = new AutoCleanMessageRepository({
        client: {
            autoCleanMessage: {
                async updateMany(args) { operations.push(args); return { count: 1 }; },
            },
        },
    });
    const expected = new Date("2026-10-08T11:00:00.000Z");
    const next = new Date("2026-10-08T13:00:00.000Z");
    assert.equal(await repository.RecordSuccess("auto-1", expected, NOW, next), true);
    assert.deepEqual(operations[0].where, { id: "auto-1", enabled: true, nextRunAt: expected });
    assert.deepEqual(operations[0].data, { lastRunAt: NOW, nextRunAt: next });
});

test("Ghost Message repository traslada CRUD y consultas a su delegate", async () => {
    const operations = [];
    const delegate = {
        async create(args) { operations.push(["create", args]); return args.data; },
        async findUnique(args) { operations.push(["findUnique", args]); return null; },
        async findMany(args) { operations.push(["findMany", args]); return []; },
        async update(args) { operations.push(["update", args]); return args.data; },
        async delete(args) { operations.push(["delete", args]); return args.where; },
    };
    const repository = new GhostMessageRepository({ client: { ghostMessage: delegate } });
    const data = {
        serverId: "111111111111111111",
        channelId: "222222222222222222",
        lifetimeValue: 1.25,
        lifetimeUnit: "hours",
        enabled: true,
    };
    await repository.Create(data);
    await repository.GetByServerId(data.serverId);
    await repository.GetEnabled();
    await repository.ExistsForChannel(data.serverId, data.channelId);
    await repository.Update("ghost-1", data);
    await repository.UpdateStatus("ghost-1", false);
    await repository.Delete("ghost-1");
    assert.deepEqual(operations.map(([name]) => name), [
        "create", "findMany", "findMany", "findUnique", "update", "update", "delete",
    ]);
});
