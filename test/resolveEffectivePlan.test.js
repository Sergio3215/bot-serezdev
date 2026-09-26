const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveEffectivePlan } = require("../server/subscriptions/resolveEffectivePlan");

const NOW = new Date("2026-09-25T12:00:00.000Z");

test("sin suscripcion el plan efectivo es free", () => {
    assert.equal(resolveEffectivePlan(null, NOW), "free");
});

test("una suscripcion que no esta activa da plan free", () => {
    assert.equal(resolveEffectivePlan({
        tier: { code: "premium" },
        status: { code: "canceled" },
        currentPeriodEnd: null,
    }, NOW), "free");
});

test("una suscripcion activa vencida da plan free", () => {
    assert.equal(resolveEffectivePlan({
        tier: { code: "premium" },
        status: { code: "active" },
        currentPeriodEnd: new Date("2026-09-25T11:59:59.000Z"),
    }, NOW), "free");
});

test("un pago unico activo no vence", () => {
    assert.equal(resolveEffectivePlan({
        tier: { code: "premium" },
        status: { code: "active" },
        currentPeriodEnd: null,
    }, NOW), "premium");
});

test("una suscripcion activa con vencimiento futuro conserva su tier", () => {
    assert.equal(resolveEffectivePlan({
        tier: { code: "pro" },
        status: { code: "active" },
        currentPeriodEnd: new Date("2026-10-25T12:00:00.000Z"),
    }, NOW), "pro");
});
