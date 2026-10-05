const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createScheduledTaskController,
    validateScheduledTaskPayload,
    validateTime,
    validateTimezone,
    validateWeekdays,
} = require("../server/routes/scheduledTask/scheduledTask.controller.js");

const SERVER_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";

const validPayload = {
    serverId: SERVER_ID,
    name: "Aviso",
    channelId: CHANNEL_ID,
    content: "Mensaje programado",
    scheduleType: "weekly",
    time: "18:30",
    weekdays: [5, 1, 3],
    timezone: "America/Argentina/Buenos_Aires",
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

test("normaliza daily y weekly con hora y timezone válidas", () => {
    const weekly = validateScheduledTaskPayload(validPayload);
    assert.deepEqual(weekly.value.weekdays, [1, 3, 5]);

    const daily = validateScheduledTaskPayload({
        ...validPayload,
        name: "  Diario  ",
        content: "  Mensaje diario  ",
        scheduleType: "daily",
        weekdays: [1, 2],
    });
    assert.equal(daily.value.name, "Diario");
    assert.equal(daily.value.content, "Mensaje diario");
    assert.deepEqual(daily.value.weekdays, []);

    assert.deepEqual(validateTime("00:00"), { value: "00:00" });
    assert.deepEqual(validateTime("23:59"), { value: "23:59" });
    assert.deepEqual(
        validateTimezone("America/Argentina/Buenos_Aires"),
        { value: "America/Argentina/Buenos_Aires" },
    );
});

test("rechaza IDs, contenido, recurrencia, hora, días, timezone y enabled inválidos", () => {
    const invalidPayloads = [
        { ...validPayload, serverId: "server" },
        { ...validPayload, channelId: "channel" },
        { ...validPayload, name: "  " },
        { ...validPayload, content: "  " },
        { ...validPayload, content: "x".repeat(2001) },
        { ...validPayload, scheduleType: "monthly" },
        { ...validPayload, time: "8:30" },
        { ...validPayload, time: "24:00" },
        { ...validPayload, weekdays: [1, 1] },
        { ...validPayload, weekdays: [7] },
        { ...validPayload, weekdays: [] },
        { ...validPayload, timezone: "Mars/Olympus" },
        { ...validPayload, enabled: "true" },
    ];

    for (const payload of invalidPayloads) {
        assert.equal(typeof validateScheduledTaskPayload(payload).error, "string");
    }

    assert.match(validateWeekdays({}, "daily").error, /array/);
});

test("CRUD y status delegan datos normalizados al DB layer", async () => {
    const calls = [];
    const db = {
        async GetByServerId(serverId) {
            calls.push(["get", serverId]);
            return [{ id: "task-1", serverId }];
        },
        async Create(data) {
            calls.push(["create", data]);
            return { id: "task-1", ...data };
        },
        async Update(id, data) {
            calls.push(["update", id, data]);
            return { id, ...data };
        },
        async UpdateStatus(id, enabled) {
            calls.push(["status", id, enabled]);
            return { id, enabled };
        },
        async Delete(id) {
            calls.push(["delete", id]);
            return { id };
        },
    };
    const controller = createScheduledTaskController(db);

    const getRes = response();
    await controller.getScheduledTasks({ query: { serverId: SERVER_ID } }, getRes);

    const createRes = response();
    await controller.createScheduledTask({ body: validPayload }, createRes);

    const updateRes = response();
    await controller.updateScheduledTask({
        params: { id: "task-1" },
        body: {
            ...validPayload,
            enabled: undefined,
            scheduleType: "daily",
        },
    }, updateRes);

    const statusRes = response();
    await controller.updateScheduledTaskStatus({
        params: { id: "task-1" },
        body: { enabled: false },
    }, statusRes);

    const deleteRes = response();
    await controller.deleteScheduledTask({ params: { id: "task-1" } }, deleteRes);

    assert.equal(getRes.statusCode, 200);
    assert.equal(createRes.statusCode, 201);
    assert.equal(updateRes.statusCode, 200);
    assert.equal(statusRes.statusCode, 200);
    assert.equal(deleteRes.statusCode, 200);
    assert.deepEqual(calls[0], ["get", SERVER_ID]);
    assert.deepEqual(calls[1][1].weekdays, [1, 3, 5]);
    assert.deepEqual(calls[2][2].weekdays, []);
    assert.deepEqual(calls[3], ["status", "task-1", false]);
    assert.deepEqual(calls[4], ["delete", "task-1"]);
});

test("controller no escribe payloads inválidos y traduce P2025", async () => {
    let writes = 0;
    const db = {
        async Create() {
            writes += 1;
        },
        async Update() {
            writes += 1;
        },
        async Delete() {
            const error = new Error("missing");
            error.code = "P2025";
            throw error;
        },
    };
    const controller = createScheduledTaskController(db);
    const createRes = response();
    const updateRes = response();
    const deleteRes = response();

    await controller.createScheduledTask({
        body: { ...validPayload, channelId: "invalid" },
    }, createRes);
    await controller.updateScheduledTask({
        params: { id: "task-1" },
        body: { ...validPayload, enabled: "false" },
    }, updateRes);
    await controller.deleteScheduledTask({ params: { id: "task-1" } }, deleteRes);

    assert.equal(createRes.statusCode, 400);
    assert.equal(updateRes.statusCode, 400);
    assert.equal(deleteRes.statusCode, 404);
    assert.equal(writes, 0);
});
