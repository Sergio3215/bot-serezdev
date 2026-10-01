const ChangeSignaturesEqual = (left, right) => (
    left !== null
    && right !== null
    && left.count === right.count
    && left.lastUpdatedAt === right.lastUpdatedAt
);

const NormalizeChangeSignature = (signature) => {
    if (
        !signature
        || !Number.isInteger(signature.count)
        || signature.count < 0
        || (
            signature.lastUpdatedAt !== null
            && typeof signature.lastUpdatedAt !== "string"
        )
    ) {
        throw new TypeError("La firma de cambios de comandos personalizados es inválida");
    }

    return Object.freeze({
        count: signature.count,
        lastUpdatedAt: signature.lastUpdatedAt,
    });
};

const CreateCustomCommandMapRefresher = ({
    getChangeSignature,
    loadCustomCommandMap,
    logger = console,
}) => {
    if (typeof getChangeSignature !== "function") {
        throw new TypeError("getChangeSignature debe ser una función");
    }

    if (typeof loadCustomCommandMap !== "function") {
        throw new TypeError("loadCustomCommandMap debe ser una función");
    }

    let lastAppliedSignature = null;
    let customCommandRefreshRunning = false;

    const refreshCustomCommandMap = async () => {
        if (customCommandRefreshRunning) {
            return {
                refreshed: false,
                reason: "already-running",
            };
        }

        customCommandRefreshRunning = true;

        try {
            const changeSignature = NormalizeChangeSignature(
                await getChangeSignature(),
            );

            if (ChangeSignaturesEqual(changeSignature, lastAppliedSignature)) {
                return {
                    refreshed: false,
                    reason: "unchanged",
                };
            }

            const summary = await loadCustomCommandMap();
            lastAppliedSignature = changeSignature;

            logger.log(
                `Custom commands refreshed: ${summary.loaded}/${summary.found} loaded, ${summary.failed} failed`,
            );

            if (summary.failed > 0) {
                logger.error(
                    "Custom commands excluded by compilation errors:",
                    summary.diagnostics,
                );
            }

            return {
                refreshed: true,
                reason: "changed",
                signature: lastAppliedSignature,
                summary,
            };
        } catch (error) {
            logger.error("Error refreshing custom commands:", error);

            return {
                refreshed: false,
                reason: "error",
                error,
            };
        } finally {
            customCommandRefreshRunning = false;
        }
    };

    const GetLastAppliedSignature = () => lastAppliedSignature;

    return Object.freeze({
        refreshCustomCommandMap,
        GetLastAppliedSignature,
    });
};

module.exports = {
    ChangeSignaturesEqual,
    NormalizeChangeSignature,
    CreateCustomCommandMapRefresher,
};
