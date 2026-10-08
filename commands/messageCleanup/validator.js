const {
    CLEANUP_TIME_UNITS,
    IsValidCleanupTimeValue,
} = require("./time.js");

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

const ValidateSnowflake = (value, label) => {
    if (typeof value !== "string" || !SNOWFLAKE_PATTERN.test(value)) {
        return { error: `${label} debe ser un snowflake válido` };
    }
    return { value };
};

const ValidateCleanupPayload = (body, {
    valueField,
    unitField,
    allowEnabled = true,
} = {}) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "El cuerpo de la configuración es inválido" };
    }

    const allowedFields = new Set([
        "serverId",
        "channelId",
        valueField,
        unitField,
        ...(allowEnabled ? ["enabled"] : []),
    ]);
    const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
    if (unknownField) {
        return { error: `La propiedad ${unknownField} no está permitida` };
    }

    const serverId = ValidateSnowflake(body.serverId, "El id del servidor");
    if (serverId.error) return serverId;
    const channelId = ValidateSnowflake(body.channelId, "El id del canal");
    if (channelId.error) return channelId;

    if (typeof body[valueField] !== "number") {
        return { error: `${valueField} debe ser un número` };
    }
    if (!CLEANUP_TIME_UNITS.includes(body[unitField])) {
        return { error: `${unitField} debe ser hours o days` };
    }
    if (!IsValidCleanupTimeValue(body[valueField], body[unitField])) {
        return {
            error: body[unitField] === "days"
                ? `${valueField} debe ser un entero positivo para days`
                : `${valueField} debe ser un múltiplo positivo de 0.25 para hours`,
        };
    }
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
        return { error: "enabled debe ser boolean" };
    }

    return {
        value: {
            serverId: serverId.value,
            channelId: channelId.value,
            [valueField]: body[valueField],
            [unitField]: body[unitField],
            ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
        },
    };
};

module.exports = {
    SNOWFLAKE_PATTERN,
    ValidateSnowflake,
    ValidateCleanupPayload,
};
