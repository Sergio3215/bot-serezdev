const CLEANUP_TIME_UNITS = Object.freeze(["hours", "days"]);
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const QUARTER_HOUR_TOLERANCE = 1e-9;

const IsValidCleanupTimeValue = (value, unit) => {
    if (!Number.isFinite(value) || value <= 0) return false;

    if (unit === "days") return Number.isInteger(value);
    if (unit !== "hours") return false;

    const quarterHours = value * 4;
    return Math.abs(quarterHours - Math.round(quarterHours)) <= QUARTER_HOUR_TOLERANCE;
};

const CleanupTimeToMilliseconds = (value, unit) => {
    if (!IsValidCleanupTimeValue(value, unit)) {
        throw new RangeError("El intervalo de limpieza es inválido");
    }

    return value * (unit === "days" ? MILLISECONDS_PER_DAY : MILLISECONDS_PER_HOUR);
};

const AddCleanupInterval = (date, value, unit) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        throw new TypeError("La fecha base es inválida");
    }

    return new Date(date.getTime() + CleanupTimeToMilliseconds(value, unit));
};

module.exports = {
    CLEANUP_TIME_UNITS,
    MILLISECONDS_PER_HOUR,
    MILLISECONDS_PER_DAY,
    IsValidCleanupTimeValue,
    CleanupTimeToMilliseconds,
    AddCleanupInterval,
};
