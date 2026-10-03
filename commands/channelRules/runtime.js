const { GetChannelRuleFromCache } = require("./cache");
const { ValidateLinkRestriction } = require("./validator");

const CreateChannelRuleRuntime = ({
    getRule = GetChannelRuleFromCache,
    logger = console,
} = {}) => {
    return async (msg) => {
        if (!msg?.guild?.id || !msg?.channel?.id || !msg?.author) {
            return { handled: false, reason: "missing-context" };
        }

        if (msg.author.bot) {
            return { handled: false, reason: "bot" };
        }

        try {
            const rule = getRule(msg.guild.id, msg.channel.id, "linkRestriction");

            if (!rule || rule.enabled === false) {
                return { handled: false, reason: rule ? "disabled" : "no-rule" };
            }

            const validation = ValidateLinkRestriction(msg.content, rule);
            if (validation.valid) {
                return { handled: false, reason: validation.reason, validation };
            }

            try {
                await msg.delete();
                return { handled: true, deleted: true, reason: validation.reason, validation };
            } catch (error) {
                logger.error("No se pudo borrar un mensaje rechazado por una regla de canal:", error);
                return {
                    handled: true,
                    deleted: false,
                    reason: validation.reason,
                    validation,
                    error,
                };
            }
        } catch (error) {
            logger.error("Error al aplicar una regla de canal:", error);
            return { handled: false, reason: "error", error };
        }
    };
};

const EnforceChannelRules = CreateChannelRuleRuntime();

module.exports = {
    CreateChannelRuleRuntime,
    EnforceChannelRules,
};
