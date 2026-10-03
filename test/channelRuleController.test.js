const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createChannelRuleController,
    validateRuleBody,
} = require("../server/routes/channelRule/channelRule.controller.js");

const validBody = {
    serverId: "server-a",
    channelId: "channel-1",
    type: "linkRestriction",
    allowedTypes: ["youtube", "x"],
    mode: "contains",
    enabled: true,
};

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

test("valida todos los campos configurables sin confiar en el frontend", () => {
    assert.match(validateRuleBody({ ...validBody, serverId: "" }).error, /servidor/);
    assert.match(validateRuleBody({ ...validBody, channelId: "" }).error, /canal/);
    assert.match(validateRuleBody({ ...validBody, type: "other" }).error, /tipo de regla/);
    assert.match(validateRuleBody({ ...validBody, allowedTypes: [] }).error, /al menos/);
    assert.match(
        validateRuleBody({ ...validBody, allowedTypes: ["youtube", "unknown"] }).error,
        /desconocido/,
    );
    assert.match(
        validateRuleBody({ ...validBody, allowedTypes: ["youtube", "youtube"] }).error,
        /duplicados/,
    );
    assert.match(validateRuleBody({ ...validBody, mode: "other" }).error, /modo/);
    assert.match(validateRuleBody({ ...validBody, enabled: "true" }).error, /estado/);
    assert.deepEqual(validateRuleBody(validBody).value, validBody);
});

test("expone listar, crear, editar, habilitar y eliminar mediante la capa DB", async () => {
    const calls = [];
    const db = {
        async GetByServerId(serverId) {
            calls.push(["get", serverId]);
            return [{ id: "rule-1", ...validBody }];
        },
        async Create(body) {
            calls.push(["create", body]);
            return { id: "rule-1", ...body };
        },
        async Update(id, body) {
            calls.push(["update", id, body]);
            return { id, ...body };
        },
        async UpdateStatus(id, enabled) {
            calls.push(["status", id, enabled]);
            return { id, ...validBody, enabled };
        },
        async Delete(id) {
            calls.push(["delete", id]);
            return { id };
        },
    };
    const controller = createChannelRuleController(db);

    const listed = response();
    await controller.getChannelRules({ query: { serverId: " server-a " } }, listed);
    assert.equal(listed.statusCode, 200);

    const created = response();
    await controller.createChannelRule({ body: validBody }, created);
    assert.equal(created.statusCode, 201);

    const updated = response();
    await controller.updateChannelRule({ params: { id: "rule-1" }, body: validBody }, updated);
    assert.equal(updated.statusCode, 200);

    const patched = response();
    await controller.updateChannelRuleEnabled(
        { params: { id: "rule-1" }, body: { enabled: false } },
        patched,
    );
    assert.equal(patched.statusCode, 200);
    assert.equal(patched.body.data.enabled, false);

    const deleted = response();
    await controller.deleteChannelRule({ params: { id: "rule-1" } }, deleted);
    assert.equal(deleted.statusCode, 200);

    assert.deepEqual(calls.map(([operation]) => operation), [
        "get",
        "create",
        "update",
        "status",
        "delete",
    ]);
});

test("mapea duplicados y registros inexistentes a respuestas HTTP", async () => {
    const duplicateDb = {
        async Create() {
            throw Object.assign(new Error("duplicate"), { code: "P2002" });
        },
    };
    const duplicate = response();
    await createChannelRuleController(duplicateDb).createChannelRule(
        { body: validBody },
        duplicate,
    );
    assert.equal(duplicate.statusCode, 409);

    const missingDb = {
        async Delete() {
            throw Object.assign(new Error("missing"), { code: "P2025" });
        },
    };
    const missing = response();
    await createChannelRuleController(missingDb).deleteChannelRule(
        { params: { id: "rule-404" } },
        missing,
    );
    assert.equal(missing.statusCode, 404);
});
