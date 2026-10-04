const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createCustomCommandController,
    validateDescription,
} = require("../server/routes/customCommand/customCommand.controller.js");

const response = () => ({
    statusCode: 200,
    body: undefined,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
});

const validBody = {
    serverId: "server-1",
    command: "!hola",
    code: "SendMessage('Hola')",
    enabled: true,
};

test("valida, recorta espacios y limita la description manual", () => {
    assert.deepEqual(validateDescription(undefined), { value: undefined });
    assert.deepEqual(validateDescription(null), { value: null });
    assert.deepEqual(validateDescription("  Saluda al canal  "), { value: "Saluda al canal" });
    assert.match(validateDescription(123).error, /texto/);
    assert.match(validateDescription("x".repeat(101)).error, /100/);
});

test("create acepta y persiste una description manual", async () => {
    let persisted;
    const controller = createCustomCommandController({
        async Create(data) {
            persisted = data;
            return { id: "command-1", ...data };
        },
    });
    const res = response();

    await controller.createCustomCommand({
        body: { ...validBody, description: "  Saluda al canal  " },
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(persisted.description, "Saluda al canal");
});

test("update acepta description y permite omitirla", async () => {
    const updates = [];
    const controller = createCustomCommandController({
        async Update(id, data) {
            updates.push({ id, data });
            return { id, ...data };
        },
    });

    await controller.updateCustomCommand({
        params: { id: "command-1" },
        body: {
            command: validBody.command,
            code: validBody.code,
            description: "  Descripción manual  ",
        },
    }, response());
    await controller.updateCustomCommand({
        params: { id: "command-1" },
        body: { command: validBody.command, code: validBody.code },
    }, response());

    assert.equal(updates[0].data.description, "Descripción manual");
    assert.equal(updates[1].data.description, undefined);
});

test("create y update rechazan descriptions inválidas antes de DB", async () => {
    let writes = 0;
    const controller = createCustomCommandController({
        async Create() {
            writes += 1;
        },
        async Update() {
            writes += 1;
        },
    });
    const invalidCreate = response();
    const invalidUpdate = response();

    await controller.createCustomCommand({
        body: { ...validBody, description: {} },
    }, invalidCreate);
    await controller.updateCustomCommand({
        params: { id: "command-1" },
        body: {
            command: validBody.command,
            code: validBody.code,
            description: "x".repeat(101),
        },
    }, invalidUpdate);

    assert.equal(invalidCreate.statusCode, 400);
    assert.equal(invalidUpdate.statusCode, 400);
    assert.equal(writes, 0);
});
