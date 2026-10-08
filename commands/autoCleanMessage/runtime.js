const { AddCleanupInterval, CleanupTimeToMilliseconds } = require("../messageCleanup/time.js");
const { DeleteChannelMessages } = require("../messageCleanup/deleteMessages.js");

const AUTO_CLEAN_TICK_MS = 60 * 1000;
const AUTO_CLEAN_RETRY_MS = 5 * 60 * 1000;
const AUTO_CLEAN_MAX_CONFIGURATIONS_PER_CYCLE = 25;

const NormalizeAutoCleanConfiguration = (configuration) => {
    if (!configuration || typeof configuration.id !== "string") {
        throw new TypeError("La configuración Auto Clean no tiene id");
    }
    const nextRunAt = new Date(configuration.nextRunAt);
    if (!Number.isFinite(nextRunAt.getTime())) {
        throw new TypeError("La configuración Auto Clean no tiene nextRunAt válido");
    }
    CleanupTimeToMilliseconds(configuration.frequencyValue, configuration.frequencyUnit);
    if (configuration.enabled !== true) {
        throw new TypeError("La configuración Auto Clean no está habilitada");
    }

    return Object.freeze({ ...configuration, nextRunAt });
};

const CreateAutoCleanMessageRuntime = ({
    client,
    repository,
    deleteMessages = DeleteChannelMessages,
    now = () => new Date(),
    logger = console,
    maxConfigurationsPerCycle = AUTO_CLEAN_MAX_CONFIGURATIONS_PER_CYCLE,
    maxMessagesPerChannel = 500,
}) => {
    if (!repository || typeof repository.RecordSuccess !== "function") {
        throw new TypeError("El repositorio Auto Clean es obligatorio");
    }

    let configurations = new Map();
    let cycleRunning = false;
    const runningConfigurations = new Set();

    const reconcile = async (records) => {
        if (!Array.isArray(records)) {
            throw new TypeError("Las configuraciones Auto Clean deben ser un array");
        }
        const next = new Map();
        const diagnostics = [];
        for (const record of records) {
            try {
                const normalized = NormalizeAutoCleanConfiguration(record);
                next.set(normalized.id, normalized);
            } catch (error) {
                diagnostics.push({ id: record?.id ?? null, error: error.message });
            }
        }
        configurations = next;
        return {
            found: records.length,
            loaded: next.size,
            failed: diagnostics.length,
            diagnostics,
        };
    };

    const processConfiguration = async (configuration) => {
        if (runningConfigurations.has(configuration.id)) {
            return { executed: false, reason: "already-running" };
        }
        runningConfigurations.add(configuration.id);
        const expectedNextRunAt = configuration.nextRunAt;
        try {
            const cleanup = await deleteMessages({
                client,
                serverId: configuration.serverId,
                channelId: configuration.channelId,
                maxMessages: maxMessagesPerChannel,
                now,
                logger,
            });
            const completedAt = now();
            const nextRunAt = AddCleanupInterval(
                completedAt,
                configuration.frequencyValue,
                configuration.frequencyUnit,
            );
            const persisted = await repository.RecordSuccess(
                configuration.id,
                expectedNextRunAt,
                completedAt,
                nextRunAt,
            );
            const currentConfiguration = configurations.get(configuration.id);
            if (
                persisted
                && currentConfiguration?.nextRunAt.getTime() === expectedNextRunAt.getTime()
            ) {
                configurations.set(configuration.id, Object.freeze({
                    ...currentConfiguration,
                    lastRunAt: completedAt,
                    nextRunAt,
                }));
            }
            return { executed: true, persisted, cleanup, nextRunAt };
        } catch (error) {
            logger.error(
                "[auto-clean-message] Falló una configuración",
                { id: configuration.id, serverId: configuration.serverId, channelId: configuration.channelId },
                error,
            );
            const retryDelay = Math.min(
                AUTO_CLEAN_RETRY_MS,
                CleanupTimeToMilliseconds(configuration.frequencyValue, configuration.frequencyUnit),
            );
            const retryAt = new Date(now().getTime() + retryDelay);
            try {
                const persisted = await repository.RecordRetry(
                    configuration.id,
                    expectedNextRunAt,
                    retryAt,
                );
                const currentConfiguration = configurations.get(configuration.id);
                if (
                    persisted
                    && currentConfiguration?.nextRunAt.getTime() === expectedNextRunAt.getTime()
                ) {
                    configurations.set(configuration.id, Object.freeze({
                        ...currentConfiguration,
                        nextRunAt: retryAt,
                    }));
                }
            } catch (persistenceError) {
                logger.error(
                    "[auto-clean-message] No se pudo guardar el reintento",
                    { id: configuration.id },
                    persistenceError,
                );
            }
            return { executed: false, reason: "error", error };
        } finally {
            runningConfigurations.delete(configuration.id);
        }
    };

    const runDue = async () => {
        if (cycleRunning) return { ran: false, reason: "already-running" };
        cycleRunning = true;
        try {
            const cycleNow = now();
            const due = [...configurations.values()]
                .filter((configuration) => configuration.nextRunAt <= cycleNow)
                .sort((left, right) => left.nextRunAt - right.nextRunAt)
                .slice(0, maxConfigurationsPerCycle);
            const results = [];
            for (const configuration of due) {
                results.push(await processConfiguration(configuration));
            }
            return {
                ran: true,
                due: due.length,
                succeeded: results.filter((result) => result.executed).length,
                failed: results.filter((result) => result.reason === "error").length,
                results,
            };
        } finally {
            cycleRunning = false;
        }
    };

    const getState = () => ({
        size: configurations.size,
        cycleRunning,
        running: runningConfigurations.size,
    });

    return Object.freeze({ reconcile, runDue, processConfiguration, getState });
};

const StartAutoCleanMessageScheduler = ({
    runDue,
    logger = console,
    intervalMilliseconds = AUTO_CLEAN_TICK_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
}) => {
    let timer = null;
    const runSafely = async () => {
        try {
            await runDue();
        } catch (error) {
            logger.error("[auto-clean-message] Falló el ciclo del scheduler", error);
        }
    };
    const start = () => {
        if (timer !== null) return timer;
        timer = setIntervalFn(() => { void runSafely(); }, intervalMilliseconds);
        return timer;
    };
    const stop = () => {
        if (timer === null) return;
        clearIntervalFn(timer);
        timer = null;
    };
    return Object.freeze({ start, stop, runSafely, isRunning: () => timer !== null });
};

module.exports = {
    AUTO_CLEAN_TICK_MS,
    AUTO_CLEAN_RETRY_MS,
    AUTO_CLEAN_MAX_CONFIGURATIONS_PER_CYCLE,
    NormalizeAutoCleanConfiguration,
    CreateAutoCleanMessageRuntime,
    StartAutoCleanMessageScheduler,
};
