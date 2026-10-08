const test = require("node:test");
const assert = require("node:assert/strict");

const { CreateAutoCleanMessageController } = require("../server/routes/autoCleanMessage/autoCleanMessage.controller.js");
const { CreateGhostMessageController } = require("../server/routes/ghostMessage/ghostMessage.controller.js");

const SERVER_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";
const OTHER_CHANNEL_ID = "333333333333333333";

const Response = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
});

const CreateRepository = () => {
    const records = new Map();
    let sequence = 0;
    return {
        records,
        async GetByServerId(serverId) {
            return [...records.values()].filter((record) => record.serverId === serverId);
        },
        async GetById(id) { return records.get(id) ?? null; },
        async Create(data) {
            if ([...records.values()].some((record) => (
                record.serverId === data.serverId && record.channelId === data.channelId
            ))) {
                const error = new Error("duplicate");
                error.code = "P2002";
                throw error;
            }
            const record = { id: `record-${++sequence}`, ...data };
            records.set(record.id, record);
            return record;
        },
        async Update(id, data) {
            const record = { ...records.get(id), ...data, id };
            records.set(id, record);
            return record;
        },
        async UpdateStatus(id, enabled) {
            const record = { ...records.get(id), enabled };
            records.set(id, record);
            return record;
        },
        async Delete(id) {
            const record = records.get(id);
            if (!record) {
                const error = new Error("missing");
                error.code = "P2025";
                throw error;
            }
            records.delete(id);
            return record;
        },
    };
};

const configurations = [
    {
        name: "Auto Clean",
        createController: (dependencies) => CreateAutoCleanMessageController(dependencies),
        payload: {
            serverId: SERVER_ID,
            channelId: CHANNEL_ID,
            frequencyValue: 2.5,
            frequencyUnit: "hours",
            enabled: true,
        },
    },
    {
        name: "Ghost Message",
        createController: (dependencies) => CreateGhostMessageController(dependencies),
        payload: {
            serverId: SERVER_ID,
            channelId: CHANNEL_ID,
            lifetimeValue: 1.25,
            lifetimeUnit: "hours",
            enabled: true,
        },
    },
];

for (const configuration of configurations) {
    test(`${configuration.name} CRUD crea, lista, edita, desactiva, activa y elimina`, async () => {
        const repository = CreateRepository();
        const conflictingRepository = { async ExistsForChannel() { return false; } };
        const controller = configuration.createController({ repository, conflictingRepository });

        const createRes = Response();
        await controller.create({ body: configuration.payload }, createRes);
        const id = createRes.body.data.id;

        const listRes = Response();
        await controller.getAll({ query: { serverId: SERVER_ID } }, listRes);

        const updateRes = Response();
        await controller.update({
            params: { id },
            body: { ...configuration.payload, channelId: OTHER_CHANNEL_ID },
        }, updateRes);

        const disableRes = Response();
        await controller.updateStatus({ params: { id }, body: { enabled: false } }, disableRes);
        const enableRes = Response();
        await controller.updateStatus({ params: { id }, body: { enabled: true } }, enableRes);
        const deleteRes = Response();
        await controller.remove({ params: { id } }, deleteRes);

        assert.equal(createRes.statusCode, 201);
        assert.equal(listRes.statusCode, 200);
        assert.equal(listRes.body.data.length, 1);
        assert.equal(updateRes.statusCode, 200);
        assert.equal(updateRes.body.data.channelId, OTHER_CHANNEL_ID);
        assert.equal(disableRes.body.data.enabled, false);
        assert.equal(enableRes.body.data.enabled, true);
        assert.equal(deleteRes.statusCode, 200);
        assert.equal(repository.records.size, 0);
    });

    test(`${configuration.name} devuelve 409 para duplicado propio`, async () => {
        const repository = CreateRepository();
        const controller = configuration.createController({
            repository,
            conflictingRepository: { async ExistsForChannel() { return false; } },
        });
        await controller.create({ body: configuration.payload }, Response());
        const duplicate = Response();
        await controller.create({ body: configuration.payload }, duplicate);
        assert.equal(duplicate.statusCode, 409);
    });

    test(`${configuration.name} devuelve 409 ante conflicto cruzado al crear y editar`, async () => {
        const repository = CreateRepository();
        const conflictingRepository = {
            conflict: true,
            async ExistsForChannel() { return this.conflict; },
        };
        const controller = configuration.createController({ repository, conflictingRepository });
        const createConflict = Response();
        await controller.create({ body: configuration.payload }, createConflict);
        assert.equal(createConflict.statusCode, 409);

        conflictingRepository.conflict = false;
        const created = Response();
        await controller.create({ body: configuration.payload }, created);
        conflictingRepository.conflict = true;
        const updateConflict = Response();
        await controller.update({
            params: { id: created.body.data.id },
            body: { ...configuration.payload, channelId: OTHER_CHANNEL_ID },
        }, updateConflict);
        assert.equal(updateConflict.statusCode, 409);
    });
}
