const { ValidateCleanupPayload } = require("../messageCleanup/validator.js");

const ValidateGhostMessagePayload = (body) => ValidateCleanupPayload(body, {
    valueField: "lifetimeValue",
    unitField: "lifetimeUnit",
});

module.exports = { ValidateGhostMessagePayload };
