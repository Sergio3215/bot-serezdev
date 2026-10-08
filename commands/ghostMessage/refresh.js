const SignaturesEqual = (left, right) => left !== null
    && right !== null
    && left.count === right.count
    && left.lastUpdatedAt === right.lastUpdatedAt;

const NormalizeSignature = (signature) => {
    if (!signature || !Number.isInteger(signature.count) || signature.count < 0) {
        throw new TypeError("La firma Ghost Message es inválida");
    }
    if (signature.lastUpdatedAt !== null && typeof signature.lastUpdatedAt !== "string") {
        throw new TypeError("La firma Ghost Message es inválida");
    }
    return Object.freeze({ ...signature });
};

const CreateGhostMessageRefresher = ({
    getChangeSignature,
    getEnabledConfigurations,
    reconcile,
    logger = console,
}) => {
    let lastAppliedSignature = null;
    let running = false;
    const refresh = async () => {
        if (running) return { refreshed: false, reason: "already-running" };
        running = true;
        try {
            const signature = NormalizeSignature(await getChangeSignature());
            if (SignaturesEqual(signature, lastAppliedSignature)) {
                return { refreshed: false, reason: "unchanged" };
            }
            const summary = await reconcile(await getEnabledConfigurations());
            lastAppliedSignature = signature;
            if (summary.failed > 0) {
                logger.error("Ghost Message configurations excluded:", summary.diagnostics);
            }
            return { refreshed: true, reason: "changed", signature, summary };
        } catch (error) {
            logger.error("Error refreshing Ghost Message configurations:", error);
            return { refreshed: false, reason: "error", error };
        } finally {
            running = false;
        }
    };
    return Object.freeze({ refresh, getLastAppliedSignature: () => lastAppliedSignature });
};

module.exports = { SignaturesEqual, NormalizeSignature, CreateGhostMessageRefresher };
