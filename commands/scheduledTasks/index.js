const {
    CreateScheduledTaskFingerprint,
    CreateScheduledTaskJob,
    NormalizeScheduledTaskForRuntime,
} = require("./runner.js");

const CreateScheduledTaskRegistry = ({
    client,
    getEnabledTasks,
    CronJobClass,
    logger = console,
}) => {
    if (typeof getEnabledTasks !== "function") {
        throw new TypeError("getEnabledTasks debe ser una función");
    }

    let entries = new Map();
    let summary = Object.freeze({
        found: 0,
        loaded: 0,
        failed: 0,
        started: 0,
        replaced: 0,
        stopped: 0,
        reused: 0,
        diagnostics: Object.freeze([]),
    });

    const reconcileScheduledTasks = async () => {
        const tasks = await getEnabledTasks();
        if (!Array.isArray(tasks)) {
            throw new TypeError("La consulta de tareas programadas debe devolver un array");
        }

        const candidates = new Map();
        const diagnostics = [];
        let reused = 0;
        let replaced = 0;

        for (const task of tasks) {
            try {
                const normalizedTask = NormalizeScheduledTaskForRuntime(task);
                const fingerprint = CreateScheduledTaskFingerprint(normalizedTask);
                const existing = entries.get(normalizedTask.id);

                if (existing?.fingerprint === fingerprint) {
                    candidates.set(normalizedTask.id, existing);
                    reused += 1;
                    continue;
                }

                const candidate = CreateScheduledTaskJob({
                    client,
                    task: normalizedTask,
                    ...(CronJobClass === undefined ? {} : { CronJobClass }),
                    logger,
                });

                if (existing) replaced += 1;
                candidates.set(candidate.task.id, candidate);
            } catch (error) {
                diagnostics.push(Object.freeze({
                    taskId: task?.id ?? null,
                    error: error instanceof Error ? error.message : String(error),
                }));
            }
        }

        let stopped = 0;
        for (const [taskId, existing] of entries) {
            if (candidates.get(taskId) === existing) continue;

            try {
                existing.job.stop();
            } catch (error) {
                logger.error(`Error stopping scheduled task: ${taskId}`, error);
            }
            stopped += 1;
        }

        const nextEntries = new Map();
        let started = 0;
        for (const [taskId, candidate] of candidates) {
            if (entries.get(taskId) === candidate) {
                nextEntries.set(taskId, candidate);
                continue;
            }

            try {
                candidate.job.start();
                nextEntries.set(taskId, candidate);
                started += 1;
            } catch (error) {
                diagnostics.push(Object.freeze({
                    taskId,
                    error: error instanceof Error ? error.message : String(error),
                }));
                try {
                    candidate.job.stop();
                } catch {
                    // El job nunca llegó a estar activo o ya se detuvo.
                }
            }
        }

        entries = nextEntries;
        summary = Object.freeze({
            found: tasks.length,
            loaded: entries.size,
            failed: diagnostics.length,
            started,
            replaced,
            stopped,
            reused,
            diagnostics: Object.freeze(diagnostics),
        });

        return summary;
    };

    const StopAllScheduledTasks = () => {
        for (const [taskId, entry] of entries) {
            try {
                entry.job.stop();
            } catch (error) {
                logger.error(`Error stopping scheduled task: ${taskId}`, error);
            }
        }
        entries = new Map();
    };

    const GetScheduledTaskEntry = (taskId) => entries.get(taskId) ?? null;
    const GetScheduledTaskCount = () => entries.size;
    const GetScheduledTaskSummary = () => summary;

    return Object.freeze({
        reconcileScheduledTasks,
        StopAllScheduledTasks,
        GetScheduledTaskEntry,
        GetScheduledTaskCount,
        GetScheduledTaskSummary,
    });
};

module.exports = {
    CreateScheduledTaskRegistry,
};
