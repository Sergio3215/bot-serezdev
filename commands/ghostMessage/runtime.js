const { CleanupTimeToMilliseconds } = require("../messageCleanup/time.js");
const { DeleteChannelMessages } = require("../messageCleanup/deleteMessages.js");

// Cinco minutos mantiene un error máximo pequeño frente al TTL mínimo de 15
// minutos, sin crear timers por mensaje ni sondear Discord agresivamente.
const GHOST_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const GHOST_MAX_CONFIGURATIONS_PER_CYCLE = 25;

const NormalizeGhostConfiguration = (configuration) => {
    if (!configuration || typeof configuration.id !== "string") {
        throw new TypeError("La configuración Ghost Message no tiene id");
    }
    CleanupTimeToMilliseconds(configuration.lifetimeValue, configuration.lifetimeUnit);
    if (configuration.enabled !== true) {
        throw new TypeError("La configuración Ghost Message no está habilitada");
    }
    return Object.freeze({ ...configuration });
};

const CreateGhostMessageRuntime = ({
    client,
    deleteMessages = DeleteChannelMessages,
    now = () => new Date(),
    logger = console,
    maxConfigurationsPerCycle = GHOST_MAX_CONFIGURATIONS_PER_CYCLE,
    maxMessagesPerChannel = 500,
}) => {
    let configurations = new Map();
    let cycleRunning = false;
    let nextStartIndex = 0;
    const runningConfigurations = new Set();

    const reconcile = async (records) => {
        if (!Array.isArray(records)) {
            throw new TypeError("Las configuraciones Ghost Message deben ser un array");
        }
        const next = new Map();
        const diagnostics = [];
        for (const record of records) {
            try {
                const normalized = NormalizeGhostConfiguration(record);
                next.set(normalized.id, normalized);
            } catch (error) {
                diagnostics.push({ id: record?.id ?? null, error: error.message });
            }
        }
        configurations = next;
        nextStartIndex = next.size === 0 ? 0 : nextStartIndex % next.size;
        return {
            found: records.length,
            loaded: next.size,
            failed: diagnostics.length,
            diagnostics,
        };
    };

    const processConfiguration = async (configuration, cycleNow = now()) => {
        if (runningConfigurations.has(configuration.id)) {
            return { processed: false, reason: "already-running" };
        }
        runningConfigurations.add(configuration.id);
        try {
            const lifetimeMs = CleanupTimeToMilliseconds(
                configuration.lifetimeValue,
                configuration.lifetimeUnit,
            );
            const cutoff = new Date(cycleNow.getTime() - lifetimeMs);
            const cleanup = await deleteMessages({
                client,
                serverId: configuration.serverId,
                channelId: configuration.channelId,
                cutoff,
                shouldDelete: (message) => message.createdTimestamp <= cutoff.getTime(),
                maxMessages: maxMessagesPerChannel,
                now,
                logger,
            });
            return { processed: true, cutoff, cleanup };
        } catch (error) {
            logger.error(
                "[ghost-message] Falló una configuración",
                { id: configuration.id, serverId: configuration.serverId, channelId: configuration.channelId },
                error,
            );
            return { processed: false, reason: "error", error };
        } finally {
            runningConfigurations.delete(configuration.id);
        }
    };

    const runSweep = async () => {
        if (cycleRunning) return { ran: false, reason: "already-running" };
        cycleRunning = true;
        try {
            const cycleNow = now();
            const allConfigurations = [...configurations.values()];
            const selected = [];
            const count = Math.min(allConfigurations.length, maxConfigurationsPerCycle);
            for (let offset = 0; offset < count; offset += 1) {
                selected.push(allConfigurations[(nextStartIndex + offset) % allConfigurations.length]);
            }
            if (allConfigurations.length > 0) {
                nextStartIndex = (nextStartIndex + count) % allConfigurations.length;
            }
            const results = [];
            for (const configuration of selected) {
                results.push(await processConfiguration(configuration, cycleNow));
            }
            return {
                ran: true,
                checked: selected.length,
                succeeded: results.filter((result) => result.processed).length,
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

    return Object.freeze({ reconcile, runSweep, processConfiguration, getState });
};

const StartGhostMessageSweeper = ({
    runSweep,
    logger = console,
    intervalMilliseconds = GHOST_SWEEP_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
}) => {
    let timer = null;
    const runSafely = async () => {
        try {
            await runSweep();
        } catch (error) {
            logger.error("[ghost-message] Falló el ciclo del sweeper", error);
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
    GHOST_SWEEP_INTERVAL_MS,
    GHOST_MAX_CONFIGURATIONS_PER_CYCLE,
    NormalizeGhostConfiguration,
    CreateGhostMessageRuntime,
    StartGhostMessageSweeper,
};
