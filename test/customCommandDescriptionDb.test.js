const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, CustomCommand } = require("../db/index.js");

const replaceDelegateMethod = (t, methodName, replacement) => {
    const original = prisma.customCommand[methodName];
    prisma.customCommand[methodName] = replacement;
    t.after(() => {
        prisma.customCommand[methodName] = original;
    });
};

test("Create y Update trasladan description a Prisma", async (t) => {
    const writes = [];
    replaceDelegateMethod(t, "create", async (operation) => {
        writes.push({ operation: "create", ...operation });
        return operation.data;
    });
    replaceDelegateMethod(t, "update", async (operation) => {
        writes.push({ operation: "update", ...operation });
        return operation.data;
    });
    const db = new CustomCommand();

    await db.Create({
        serverId: "server-1",
        command: "!hola",
        code: "code",
        description: "Saluda",
        enabled: true,
    });
    await db.Update("command-1", {
        command: "!hola",
        code: "new code",
        description: "Nueva descripción",
    });

    assert.equal(writes[0].data.description, "Saluda");
    assert.equal(writes[1].data.description, "Nueva descripción");
});

test("UpdateDescription actualiza únicamente description", async (t) => {
    let write;
    replaceDelegateMethod(t, "update", async (operation) => {
        write = operation;
        return operation.data;
    });
    const db = new CustomCommand();

    await db.UpdateDescription("command-1", "Saluda al canal");

    assert.deepEqual(write, {
        where: { id: "command-1" },
        data: { description: "Saluda al canal" },
    });
});
