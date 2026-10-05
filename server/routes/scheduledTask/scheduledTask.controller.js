const { ScheduledTask } = require("../../../db/index.js");

const defaultScheduledTaskDb = new ScheduledTask();
const CONTENT_MAX_LENGTH = 2000;
const SCHEDULE_TYPES = Object.freeze(["daily", "weekly"]);
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const isRequiredString = (value) => (
    typeof value === "string" && value.trim().length > 0
);

const validateSnowflake = (value, fieldName) => {
    if (typeof value !== "string" || !SNOWFLAKE_PATTERN.test(value)) {
        return { error: `${fieldName} debe ser un snowflake válido` };
    }

    return { value };
};

const validateTime = (time) => {
    if (typeof time !== "string") {
        return { error: "La hora es requerida" };
    }

    const match = TIME_PATTERN.exec(time);
    if (!match) {
        return { error: "La hora debe tener formato HH:mm" };
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
        return { error: "La hora está fuera de rango" };
    }

    return { value: time };
};

const validateTimezone = (timezone) => {
    if (!isRequiredString(timezone)) {
        return { error: "La zona horaria es requerida" };
    }

    const value = timezone.trim();
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    } catch {
        return { error: "La zona horaria es inválida" };
    }

    return { value };
};

const validateWeekdays = (weekdays, scheduleType) => {
    const value = weekdays ?? [];
    if (!Array.isArray(value)) {
        return { error: "Los días deben ser un array" };
    }

    if (value.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
        return { error: "Cada día debe ser un entero entre 0 y 6" };
    }

    if (new Set(value).size !== value.length) {
        return { error: "Los días no pueden estar duplicados" };
    }

    if (scheduleType === "weekly" && value.length === 0) {
        return { error: "Una tarea semanal requiere al menos un día" };
    }

    return {
        value: scheduleType === "daily"
            ? []
            : [...value].sort((left, right) => left - right),
    };
};

const validateScheduledTaskPayload = (body, { allowEnabled = true } = {}) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "El cuerpo de la tarea es inválido" };
    }

    const serverIdValidation = body.serverId === undefined
        ? { value: undefined }
        : validateSnowflake(body.serverId, "El id del servidor");
    if (serverIdValidation.error) return serverIdValidation;

    const channelIdValidation = validateSnowflake(body.channelId, "El id del canal");
    if (channelIdValidation.error) return channelIdValidation;

    if (!isRequiredString(body.name)) {
        return { error: "El nombre es requerido" };
    }

    if (!isRequiredString(body.content)) {
        return { error: "El contenido es requerido" };
    }
    const content = body.content.trim();
    if (content.length > CONTENT_MAX_LENGTH) {
        return { error: `El contenido no puede superar los ${CONTENT_MAX_LENGTH} caracteres` };
    }

    if (!SCHEDULE_TYPES.includes(body.scheduleType)) {
        return { error: "El tipo de recurrencia es inválido" };
    }

    const timeValidation = validateTime(body.time);
    if (timeValidation.error) return timeValidation;

    const weekdaysValidation = validateWeekdays(body.weekdays, body.scheduleType);
    if (weekdaysValidation.error) return weekdaysValidation;

    const timezoneValidation = validateTimezone(body.timezone);
    if (timezoneValidation.error) return timezoneValidation;

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
        return { error: "El estado de la tarea es inválido" };
    }

    return {
        value: {
            ...(serverIdValidation.value === undefined
                ? {}
                : { serverId: serverIdValidation.value }),
            name: body.name.trim(),
            channelId: channelIdValidation.value,
            content,
            scheduleType: body.scheduleType,
            time: timeValidation.value,
            weekdays: weekdaysValidation.value,
            timezone: timezoneValidation.value,
            ...(allowEnabled && body.enabled !== undefined
                ? { enabled: body.enabled }
                : {}),
        },
    };
};

const sendPersistenceError = (res, error) => {
    if (error?.code === "P2025") {
        return res.status(404).json({ message: "No se encontró la tarea programada" });
    }

    console.error("Error al guardar la tarea programada", error);
    return res.status(500).json({ message: "No se pudo guardar la tarea programada" });
};

const createScheduledTaskController = (scheduledTaskDb = defaultScheduledTaskDb) => {
    const getScheduledTasks = async (req, res) => {
        const serverIdValidation = validateSnowflake(
            req.query?.serverId,
            "El id del servidor",
        );
        if (serverIdValidation.error) {
            return res.status(400).json({ message: serverIdValidation.error });
        }

        try {
            const tasks = await scheduledTaskDb.GetByServerId(serverIdValidation.value);
            return res.status(200).json({ data: tasks });
        } catch (error) {
            console.error("No se pudieron obtener las tareas programadas", error);
            return res.status(500).json({
                message: "No se pudieron obtener las tareas programadas",
            });
        }
    };

    const createScheduledTask = async (req, res) => {
        if (req.body?.serverId === undefined) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const validation = validateScheduledTaskPayload(req.body);
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        try {
            const created = await scheduledTaskDb.Create(validation.value);
            return res.status(201).json({
                message: "Tarea programada creada con éxito",
                data: created,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateScheduledTask = async (req, res) => {
        if (!isRequiredString(req.params?.id)) {
            return res.status(400).json({ message: "El id de la tarea es requerido" });
        }
        if (req.body?.serverId === undefined) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const validation = validateScheduledTaskPayload(req.body, {
            allowEnabled: false,
        });
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        try {
            const updated = await scheduledTaskDb.Update(req.params.id, validation.value);
            return res.status(200).json({
                message: "Tarea programada editada con éxito",
                data: updated,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateScheduledTaskStatus = async (req, res) => {
        if (!isRequiredString(req.params?.id)) {
            return res.status(400).json({ message: "El id de la tarea es requerido" });
        }
        if (typeof req.body?.enabled !== "boolean") {
            return res.status(400).json({ message: "El estado de la tarea es inválido" });
        }

        try {
            const updated = await scheduledTaskDb.UpdateStatus(
                req.params.id,
                req.body.enabled,
            );
            return res.status(200).json({
                message: req.body.enabled
                    ? "Tarea programada activada con éxito"
                    : "Tarea programada desactivada con éxito",
                data: updated,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const deleteScheduledTask = async (req, res) => {
        if (!isRequiredString(req.params?.id)) {
            return res.status(400).json({ message: "El id de la tarea es requerido" });
        }

        try {
            const deleted = await scheduledTaskDb.Delete(req.params.id);
            return res.status(200).json({
                message: "Tarea programada eliminada con éxito",
                data: deleted,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    return {
        getScheduledTasks,
        createScheduledTask,
        updateScheduledTask,
        updateScheduledTaskStatus,
        deleteScheduledTask,
    };
};

const controller = createScheduledTaskController();

module.exports = {
    ...controller,
    createScheduledTaskController,
    validateScheduledTaskPayload,
    validateSnowflake,
    validateTime,
    validateTimezone,
    validateWeekdays,
    CONTENT_MAX_LENGTH,
    SCHEDULE_TYPES,
};
