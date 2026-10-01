const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CreateCustomCommandMapRefresher,
} = require("../commands/custom/refresh.js");

const Summary = Object.freeze({
    found: 1,
    loaded: 1,
    failed: 0,
    diagnostics: [],
});

const CreateLogger = () => {
    const logs = [];
    const errors = [];

    return {
        logs,
        errors,
        log(...values) {
            logs.push(values);
        },
        error(...values) {
            errors.push(values);
        },
    };
};

test("sin cambios entre pasadas no vuelve a cargar el Map ni genera otro log", async () => {
    const logger = CreateLogger();
    const signature = {
        count: 1,
        lastUpdatedAt: "2026-10-01T12:00:00.000Z",
    };
    let loads = 0;
    const refresher = CreateCustomCommandMapRefresher({
        getChangeSignature: async () => signature,
        loadCustomCommandMap: async () => {
            loads += 1;
            return Summary;
        },
        logger,
    });

    const initial = await refresher.refreshCustomCommandMap();
    const unchanged = await refresher.refreshCustomCommandMap();

    assert.equal(initial.refreshed, true);
    assert.equal(unchanged.reason, "unchanged");
    assert.equal(loads, 1);
    assert.equal(logger.logs.length, 1);
});

test("crear, editar, activar, desactivar y borrar provocan una recarga", async () => {
    const signatures = [
        { count: 1, lastUpdatedAt: "2026-10-01T12:00:00.000Z" },
        { count: 2, lastUpdatedAt: "2026-10-01T12:00:01.000Z" },
        { count: 2, lastUpdatedAt: "2026-10-01T12:00:02.000Z" },
        { count: 2, lastUpdatedAt: "2026-10-01T12:00:03.000Z" },
        { count: 2, lastUpdatedAt: "2026-10-01T12:00:04.000Z" },
        { count: 1, lastUpdatedAt: "2026-10-01T12:00:03.000Z" },
    ];
    let current = 0;
    let loads = 0;
    const refresher = CreateCustomCommandMapRefresher({
        getChangeSignature: async () => signatures[current],
        loadCustomCommandMap: async () => {
            loads += 1;
            return Summary;
        },
        logger: CreateLogger(),
    });

    for (current = 0; current < signatures.length; current += 1) {
        const result = await refresher.refreshCustomCommandMap();
        assert.equal(result.refreshed, true);
    }

    assert.equal(loads, signatures.length);
});

test("borrar y crear dentro de la misma ventana recarga aunque la cantidad sea igual", async () => {
    let signature = {
        count: 2,
        lastUpdatedAt: "2026-10-01T12:00:00.000Z",
    };
    let loads = 0;
    const refresher = CreateCustomCommandMapRefresher({
        getChangeSignature: async () => signature,
        loadCustomCommandMap: async () => {
            loads += 1;
            return Summary;
        },
        logger: CreateLogger(),
    });

    await refresher.refreshCustomCommandMap();
    signature = {
        count: 2,
        lastUpdatedAt: "2026-10-01T12:00:05.000Z",
    };
    const result = await refresher.refreshCustomCommandMap();

    assert.equal(result.refreshed, true);
    assert.equal(loads, 2);
});

test("si la recarga falla no guarda la firma y vuelve a intentarlo", async () => {
    const logger = CreateLogger();
    let signature = {
        count: 1,
        lastUpdatedAt: "2026-10-01T12:00:00.000Z",
    };
    let loads = 0;
    let failNextLoad = false;
    const refresher = CreateCustomCommandMapRefresher({
        getChangeSignature: async () => signature,
        loadCustomCommandMap: async () => {
            loads += 1;
            if (failNextLoad) {
                failNextLoad = false;
                throw new Error("Database unavailable");
            }
            return Summary;
        },
        logger,
    });

    await refresher.refreshCustomCommandMap();
    const initialSignature = refresher.GetLastAppliedSignature();

    signature = {
        count: 2,
        lastUpdatedAt: "2026-10-01T12:00:01.000Z",
    };
    failNextLoad = true;
    const failed = await refresher.refreshCustomCommandMap();

    assert.equal(failed.reason, "error");
    assert.deepEqual(refresher.GetLastAppliedSignature(), initialSignature);

    const retried = await refresher.refreshCustomCommandMap();
    assert.equal(retried.refreshed, true);
    assert.deepEqual(refresher.GetLastAppliedSignature(), signature);
    assert.equal(loads, 3);
    assert.equal(logger.errors.length, 1);
});

test("dos pasadas superpuestas omiten la segunda", async () => {
    let releaseSignature;
    let signatureRequests = 0;
    let loads = 0;
    const pendingSignature = new Promise((resolve) => {
        releaseSignature = resolve;
    });
    const refresher = CreateCustomCommandMapRefresher({
        getChangeSignature: async () => {
            signatureRequests += 1;
            return pendingSignature;
        },
        loadCustomCommandMap: async () => {
            loads += 1;
            return Summary;
        },
        logger: CreateLogger(),
    });

    const firstPass = refresher.refreshCustomCommandMap();
    const secondPass = await refresher.refreshCustomCommandMap();

    assert.equal(secondPass.reason, "already-running");
    assert.equal(signatureRequests, 1);
    assert.equal(loads, 0);

    releaseSignature({
        count: 1,
        lastUpdatedAt: "2026-10-01T12:00:00.000Z",
    });
    const firstResult = await firstPass;

    assert.equal(firstResult.refreshed, true);
    assert.equal(loads, 1);
});
