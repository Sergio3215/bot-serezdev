const test = require("node:test");
const assert = require("node:assert/strict");

const { ValidateAutoCleanMessagePayload } = require("../commands/autoCleanMessage/validator.js");
const { ValidateGhostMessagePayload } = require("../commands/ghostMessage/validator.js");
const { CleanupTimeToMilliseconds } = require("../commands/messageCleanup/time.js");

const SERVER_ID = "111111111111111111";
const CHANNEL_ID = "222222222222222222";

const validate = (feature, value, unit, overrides = {}) => {
    const autoClean = feature === "auto";
    const payload = {
        serverId: SERVER_ID,
        channelId: CHANNEL_ID,
        [autoClean ? "frequencyValue" : "lifetimeValue"]: value,
        [autoClean ? "frequencyUnit" : "lifetimeUnit"]: unit,
        enabled: true,
        ...overrides,
    };
    return autoClean
        ? ValidateAutoCleanMessagePayload(payload)
        : ValidateGhostMessagePayload(payload);
};

for (const feature of ["auto", "ghost"]) {
    test(`${feature} acepta cuartos de hora y enteros de días`, () => {
        for (const value of [0.25, 0.50, 0.75, 1, 1.25, 2.50]) {
            assert.equal(validate(feature, value, "hours").error, undefined, `${value} hours`);
        }
        for (const value of [1, 2, 3, 7, 15, 30]) {
            assert.equal(validate(feature, value, "days").error, undefined, `${value} days`);
        }
    });

    test(`${feature} rechaza fracciones arbitrarias, cero, negativos y days fraccionarios`, () => {
        for (const value of [2.10, 1.33, 0, -1, 0.10, 0.20, 0.30, 2.60]) {
            assert.equal(typeof validate(feature, value, "hours").error, "string", `${value} hours`);
        }
        for (const value of [0, -1, 0.5, 1.25, 1.5, 2.5]) {
            assert.equal(typeof validate(feature, value, "days").error, "string", `${value} days`);
        }
    });

    test(`${feature} rechaza unidad, snowflake, enabled y propiedades desconocidas`, () => {
        assert.equal(typeof validate(feature, 1, "weeks").error, "string");
        assert.equal(typeof validate(feature, 1, "hours", { serverId: "bad" }).error, "string");
        assert.equal(typeof validate(feature, 1, "hours", { channelId: "bad" }).error, "string");
        assert.equal(typeof validate(feature, 1, "hours", { enabled: "true" }).error, "string");
        assert.equal(typeof validate(feature, 1, "hours", { unexpected: true }).error, "string");
    });
}

test("la conversión conserva equivalencias de cuartos de hora", () => {
    assert.equal(CleanupTimeToMilliseconds(0.25, "hours"), 15 * 60 * 1000);
    assert.equal(CleanupTimeToMilliseconds(2.5, "hours"), 150 * 60 * 1000);
    assert.equal(CleanupTimeToMilliseconds(2, "days"), 48 * 60 * 60 * 1000);
});
