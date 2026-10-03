const { ChannelRule } = require("../../db/index.js");

const signaturesEqual = (left, right) => (
    left !== null
    && right !== null
    && left.count === right.count
    && left.lastUpdatedAt === right.lastUpdatedAt
);

const normalizeSignature = (signature) => {
    if (
        !signature
        || !Number.isInteger(signature.count)
        || signature.count < 0
        || (
            signature.lastUpdatedAt !== null
            && typeof signature.lastUpdatedAt !== "string"
        )
    ) {
        throw new TypeError("La firma de cambios de reglas de canal es inválida");
    }

    return {
        count: signature.count,
        lastUpdatedAt: signature.lastUpdatedAt,
    };
};

const CreateChannelRuleCache = ({
    getChangeSignature,
    getRules,
    logger = console,
}) => {
    let state = {
        ready: false,
        loadedAt: null,
        signature: null,
        rules: new Map(),
    };
    let refreshPromise = null;

    const refresh = async () => {
        if (refreshPromise !== null) return refreshPromise;

        refreshPromise = (async () => {
            try {
                const signature = normalizeSignature(await getChangeSignature());

                if (state.ready && signaturesEqual(signature, state.signature)) {
                    return { refreshed: false, reason: "unchanged", count: signature.count };
                }

                const records = await getRules();
                const temporaryRules = new Map();

                for (const record of records) {
                    const key = `${record.serverId}:${record.channelId}`;
                    let rulesByType = temporaryRules.get(key);

                    if (!rulesByType) {
                        rulesByType = new Map();
                        temporaryRules.set(key, rulesByType);
                    }

                    rulesByType.set(record.type, Object.freeze({
                        ...record,
                        allowedTypes: Object.freeze([...record.allowedTypes]),
                    }));
                }

                state = {
                    ready: true,
                    loadedAt: new Date(),
                    signature,
                    rules: temporaryRules,
                };

                return { refreshed: true, reason: "changed", count: records.length };
            } catch (error) {
                logger.error("Error refreshing channel rules:", error);
                return { refreshed: false, reason: "error", error };
            } finally {
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    };

    const get = (serverId, channelId, type = "linkRestriction") => (
        state.rules.get(`${serverId}:${channelId}`)?.get(type) ?? null
    );

    const getState = () => ({
        ready: state.ready,
        loadedAt: state.loadedAt,
        signature: state.signature,
        size: state.rules.size,
    });

    return Object.freeze({ refresh, get, getState });
};

const channelRuleDb = new ChannelRule();
const defaultCache = CreateChannelRuleCache({
    getChangeSignature: () => channelRuleDb.GetChangeSignature(),
    getRules: () => channelRuleDb.GetAll(),
});

module.exports = {
    CreateChannelRuleCache,
    RefreshChannelRuleCache: defaultCache.refresh,
    GetChannelRuleFromCache: defaultCache.get,
    GetChannelRuleCacheState: defaultCache.getState,
};
