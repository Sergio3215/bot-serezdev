const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const INACTIVITY_DAYS = 30;
const INACTIVITY_MESSAGE = "Se ha terminado la racha del contador por inactividad de 30 dias.";

const LogCounterError = (logger, level, message, context, error) => {
    const log = logger?.[level] ?? logger?.error ?? (() => {});
    log.call(logger, message, context, error);
};

const ResolveGuild = async (client, serverId) => {
    const cached = client?.guilds?.cache?.get?.(serverId);
    if (cached) return cached;

    if (typeof client?.guilds?.fetch !== "function") return null;
    return await client.guilds.fetch(serverId);
};

const ResolveChannel = async (guild, channelId) => {
    const cached = guild?.channels?.cache?.get?.(channelId);
    if (cached) return cached;

    if (typeof guild?.channels?.fetch !== "function") return null;
    return await guild.channels.fetch(channelId);
};

const IsSendableGuildChannel = (channel, serverId) => {
    if (!channel || typeof channel.send !== "function") return false;
    if (channel.guildId && channel.guildId !== serverId) return false;
    if (typeof channel.isTextBased === "function" && !channel.isTextBased()) return false;
    return true;
};

const CreateCounterInactivityProcessor = ({
    counterDb,
    client,
    now = () => new Date(),
    logger = console,
}) => {
    if (!counterDb || typeof counterDb.Get !== "function") {
        throw new TypeError("counterDb.Get es obligatorio");
    }
    if (typeof counterDb.ResetIfInactive !== "function") {
        throw new TypeError("counterDb.ResetIfInactive es obligatorio");
    }

    const notifyExpiration = async (counter) => {
        const context = {
            serverId: counter.serverId,
            channelId: counter.channelId,
            operation: "notify-inactivity-reset",
        };

        try {
            const guild = await ResolveGuild(client, counter.serverId);
            if (!guild) {
                LogCounterError(logger, "warn", "[counter] El servidor ya no está disponible", context);
                return false;
            }

            const channel = await ResolveChannel(guild, counter.channelId);
            if (!IsSendableGuildChannel(channel, counter.serverId)) {
                LogCounterError(logger, "warn", "[counter] El canal ya no está disponible para enviar", context);
                return false;
            }

            await channel.send(INACTIVITY_MESSAGE);
            return true;
        } catch (error) {
            // El estado de negocio ya fue reseteado. Un fallo de Discord no lo revierte.
            LogCounterError(logger, "warn", "[counter] No se pudo notificar el reset por inactividad", context, error);
            return false;
        }
    };

    const processCounter = async (counter, cutoff, resetAt) => {
        const modifiedOn = new Date(counter.modifiedOn);
        if (
            !Number.isFinite(modifiedOn.getTime())
            || modifiedOn > cutoff
            || counter.count <= 0
        ) {
            return { reset: false, notified: false };
        }

        // La condición se evalúa atómicamente en DB. Si hubo actividad o una
        // reconfiguración desde la lectura, no se toca ni se notifica el registro.
        const reset = await counterDb.ResetIfInactive(counter.serverId, cutoff, resetAt);
        if (!reset) return { reset: false, notified: false };

        const notified = await notifyExpiration(counter);
        return { reset: true, notified };
    };

    const run = async () => {
        const resetAt = now();
        if (!(resetAt instanceof Date) || !Number.isFinite(resetAt.getTime())) {
            throw new TypeError("now debe devolver una fecha válida");
        }

        const cutoff = new Date(resetAt.getTime() - (INACTIVITY_DAYS * DAY_IN_MILLISECONDS));
        const counters = await counterDb.Get();
        const summary = {
            checked: counters.length,
            reset: 0,
            notified: 0,
            failed: 0,
        };

        for (const counter of counters) {
            try {
                const result = await processCounter(counter, cutoff, resetAt);
                if (result.reset) summary.reset += 1;
                if (result.notified) summary.notified += 1;
            } catch (error) {
                summary.failed += 1;
                LogCounterError(
                    logger,
                    "error",
                    "[counter] Falló el procesamiento de inactividad",
                    {
                        serverId: counter?.serverId,
                        channelId: counter?.channelId,
                        operation: "reset-if-inactive",
                    },
                    error,
                );
            }
        }

        return summary;
    };

    return { run };
};

const StartCounterInactivityScheduler = ({
    run,
    logger = console,
    intervalMilliseconds = DAY_IN_MILLISECONDS,
    setIntervalFn = setInterval,
}) => {
    const runSafely = async () => {
        try {
            await run();
        } catch (error) {
            LogCounterError(
                logger,
                "error",
                "[counter] Falló el job de inactividad",
                { operation: "inactivity-job" },
                error,
            );
        }
    };

    return setIntervalFn(() => {
        void runSafely();
    }, intervalMilliseconds);
};

module.exports = {
    DAY_IN_MILLISECONDS,
    INACTIVITY_DAYS,
    INACTIVITY_MESSAGE,
    CreateCounterInactivityProcessor,
    StartCounterInactivityScheduler,
};
