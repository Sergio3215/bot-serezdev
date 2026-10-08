const { ValidateCleanupPayload } = require("../messageCleanup/validator.js");

const ValidateAutoCleanMessagePayload = (body) => ValidateCleanupPayload(body, {
    valueField: "frequencyValue",
    unitField: "frequencyUnit",
});

module.exports = { ValidateAutoCleanMessagePayload };
