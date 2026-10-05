const { CronJob } = require("cron");

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const ParseScheduledTaskTime = (time) => {
    if (typeof time !== "string") {
        throw new TypeError("La hora de la tarea programada es inválida");
    }

    const match = TIME_PATTERN.exec(time);
    if (!match) {
        throw new TypeError("La hora de la tarea programada debe usar HH:mm");
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
        throw new RangeError("La hora de la tarea programada está fuera de rango");
    }

    return { hour, minute };
};

const ValidateRuntimeTimezone = (timezone) => {
    if (typeof timezone !== "string" || timezone.length === 0) {
        throw new TypeError("La zona horaria de la tarea programada es inválida");
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
        throw new RangeError("La zona horaria de la tarea programada es inválida");
    }

    return timezone;
};

const NormalizeRuntimeWeekdays = (weekdays, scheduleType) => {
    const value = weekdays ?? [];
    if (
        !Array.isArray(value)
        || value.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
        || new Set(value).size !== value.length
    ) {
        throw new TypeError("Los días de la tarea programada son inválidos");
    }

    if (scheduleType === "weekly" && value.length === 0) {
        throw new TypeError("La tarea semanal no tiene días configurados");
    }

    return scheduleType === "daily"
        ? []
        : [...value].sort((left, right) => left - right);
};

const NormalizeScheduledTaskForRuntime = (task) => {
    if (!task || typeof task !== "object") {
        throw new TypeError("La tarea programada es inválida");
    }
    if (typeof task.id !== "string" || task.id.length === 0) {
        throw new TypeError("La tarea programada no tiene id");
    }
    if (!SNOWFLAKE_PATTERN.test(task.serverId ?? "")) {
        throw new TypeError("El serverId de la tarea programada es inválido");
    }
    if (!SNOWFLAKE_PATTERN.test(task.channelId ?? "")) {
        throw new TypeError("El channelId de la tarea programada es inválido");
    }
    if (typeof task.content !== "string" || task.content.length === 0 || task.content.length > 2000) {
        throw new TypeError("El contenido de la tarea programada es inválido");
    }
    if (!(["daily", "weekly"].includes(task.scheduleType))) {
        throw new TypeError("El tipo de recurrencia de la tarea programada es inválido");
    }
    if (task.enabled !== true) {
        throw new TypeError("La tarea programada no está habilitada");
    }

    const { hour, minute } = ParseScheduledTaskTime(task.time);
    const weekdays = NormalizeRuntimeWeekdays(task.weekdays, task.scheduleType);
    const timezone = ValidateRuntimeTimezone(task.timezone);

    return Object.freeze({
        id: task.id,
        serverId: task.serverId,
        channelId: task.channelId,
        content: task.content,
        scheduleType: task.scheduleType,
        time: task.time,
        hour,
        minute,
        weekdays: Object.freeze(weekdays),
        timezone,
        enabled: true,
        updatedAt: task.updatedAt instanceof Date
            ? task.updatedAt.toISOString()
            : (task.updatedAt ?? null),
    });
};

const BuildScheduledTaskCronExpression = (task) => {
    const normalized = task?.hour === undefined
        ? NormalizeScheduledTaskForRuntime(task)
        : task;

    if (normalized.scheduleType === "daily") {
        return `0 ${normalized.minute} ${normalized.hour} * * *`;
    }

    return `0 ${normalized.minute} ${normalized.hour} * * ${normalized.weekdays.join(",")}`;
};

const CreateScheduledTaskFingerprint = (task) => JSON.stringify({
    id: task.id,
    serverId: task.serverId,
    channelId: task.channelId,
    content: task.content,
    scheduleType: task.scheduleType,
    time: task.time,
    weekdays: task.weekdays,
    timezone: task.timezone,
    updatedAt: task.updatedAt,
});

const ResolveScheduledTaskGuild = async (client, serverId) => {
    const cached = client?.guilds?.cache?.get?.(serverId);
    if (cached) return cached;

    if (typeof client?.guilds?.fetch !== "function") return null;
    return await client.guilds.fetch(serverId);
};

const ResolveScheduledTaskChannel = async (guild, channelId) => {
    const cached = guild?.channels?.cache?.get?.(channelId);
    if (cached) return cached;

    if (typeof guild?.channels?.fetch !== "function") return null;
    return await guild.channels.fetch(channelId);
};

const IsScheduledTaskChannelSendable = (channel) => {
    if (!channel || typeof channel.send !== "function") return false;
    if (typeof channel.isTextBased === "function" && !channel.isTextBased()) return false;
    if (typeof channel.isSendable === "function" && !channel.isSendable()) return false;
    return true;
};

const ExecuteScheduledTask = async (client, task, logger = console) => {
    try {
        const guild = await ResolveScheduledTaskGuild(client, task.serverId);
        if (!guild) {
            throw new Error(`No se encontró el servidor ${task.serverId}`);
        }

        const channel = await ResolveScheduledTaskChannel(guild, task.channelId);
        if (!IsScheduledTaskChannelSendable(channel)) {
            throw new Error(`El canal ${task.channelId} no está disponible para enviar mensajes`);
        }

        await channel.send({ content: task.content });
        return true;
    } catch (error) {
        logger.error(`Scheduled task execution failed: ${task.id}`, error);
        return false;
    }
};

const CreateScheduledTaskJob = ({
    client,
    task,
    CronJobClass = CronJob,
    logger = console,
}) => {
    const normalizedTask = NormalizeScheduledTaskForRuntime(task);
    const cronExpression = BuildScheduledTaskCronExpression(normalizedTask);
    const onTick = () => {
        void ExecuteScheduledTask(client, normalizedTask, logger);
    };
    const job = new CronJobClass(
        cronExpression,
        onTick,
        null,
        false,
        normalizedTask.timezone,
    );

    return Object.freeze({
        job,
        task: normalizedTask,
        cronExpression,
        fingerprint: CreateScheduledTaskFingerprint(normalizedTask),
    });
};

module.exports = {
    ParseScheduledTaskTime,
    ValidateRuntimeTimezone,
    NormalizeRuntimeWeekdays,
    NormalizeScheduledTaskForRuntime,
    BuildScheduledTaskCronExpression,
    CreateScheduledTaskFingerprint,
    ResolveScheduledTaskGuild,
    ResolveScheduledTaskChannel,
    IsScheduledTaskChannelSendable,
    ExecuteScheduledTask,
    CreateScheduledTaskJob,
};
