const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, ScheduledTask } = require("../db/index.js");

const taskData = {
    serverId: "111111111111111111",
    name: "Aviso",
    channelId: "222222222222222222",
    content: "Mensaje",
    scheduleType: "weekly",
    time: "18:30",
    weekdays: [1, 3, 5],
    timezone: "America/Argentina/Buenos_Aires",
    enabled: true,
};

const replaceDelegateMethod = (t, methodName, replacement) => {
    const original = prisma.scheduledTask[methodName];
    prisma.scheduledTask[methodName] = replacement;
    t.after(() => {
        prisma.scheduledTask[methodName] = original;
    });
};

test("ScheduledTask Create y Update trasladan la configuración", async (t) => {
    const writes = [];
    replaceDelegateMethod(t, "create", async (operation) => {
        writes.push(operation);
        return operation.data;
    });
    replaceDelegateMethod(t, "update", async (operation) => {
        writes.push(operation);
        return operation.data;
    });
    const db = new ScheduledTask();

    await db.Create(taskData);
    await db.Update("task-1", {
        ...taskData,
        name: "Nuevo aviso",
        scheduleType: "daily",
        weekdays: [],
    });

    assert.deepEqual(writes[0].data, taskData);
    assert.equal(writes[1].where.id, "task-1");
    assert.equal(writes[1].data.name, "Nuevo aviso");
    assert.equal(writes[1].data.scheduleType, "daily");
    assert.deepEqual(writes[1].data.weekdays, []);
    assert.equal(Object.hasOwn(writes[1].data, "serverId"), false);
    assert.equal(Object.hasOwn(writes[1].data, "enabled"), false);
});

test("ScheduledTask queries, status, delete y firma usan Prisma", async (t) => {
    const operations = [];
    replaceDelegateMethod(t, "findMany", async (operation) => {
        operations.push(["findMany", operation]);
        return [];
    });
    replaceDelegateMethod(t, "update", async (operation) => {
        operations.push(["update", operation]);
        return operation.data;
    });
    replaceDelegateMethod(t, "delete", async (operation) => {
        operations.push(["delete", operation]);
        return operation.where;
    });
    replaceDelegateMethod(t, "aggregate", async (operation) => {
        operations.push(["aggregate", operation]);
        return {
            _count: { _all: 2 },
            _max: { updatedAt: new Date("2026-10-04T12:00:00.000Z") },
        };
    });
    const db = new ScheduledTask();

    await db.GetByServerId(taskData.serverId);
    await db.GetEnabled();
    await db.UpdateStatus("task-1", false);
    await db.Delete("task-1");
    const signature = await db.GetChangeSignature();

    assert.deepEqual(operations[0][1].where, { serverId: taskData.serverId });
    assert.deepEqual(operations[1][1].where, { enabled: true });
    assert.deepEqual(operations[2][1].data, { enabled: false });
    assert.deepEqual(operations[3][1].where, { id: "task-1" });
    assert.deepEqual(signature, {
        count: 2,
        lastUpdatedAt: "2026-10-04T12:00:00.000Z",
    });
});
