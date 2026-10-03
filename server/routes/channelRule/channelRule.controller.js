const { ChannelRule } = require("../../../db/index");
const {
    ALLOWED_LINK_TYPES,
    CHANNEL_RULE_TYPES,
    LINK_RULE_MODES,
} = require("../../../commands/channelRules/validator");

const defaultChannelRuleDb = new ChannelRule();

const isRequiredString = (value) => (
    typeof value === "string" && value.trim().length > 0
);

const validateRuleBody = (body) => {
    const {
        serverId,
        channelId,
        type,
        allowedTypes,
        mode,
        enabled,
    } = body ?? {};

    if (!isRequiredString(serverId)) {
        return { error: "El id del servidor es requerido" };
    }

    if (!isRequiredString(channelId)) {
        return { error: "El id del canal es requerido" };
    }

    if (!CHANNEL_RULE_TYPES.has(type)) {
        return { error: "El tipo de regla es inválido" };
    }

    if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
        return { error: "Debe indicar al menos un tipo de enlace permitido" };
    }

    if (allowedTypes.some((allowedType) => !ALLOWED_LINK_TYPES.has(allowedType))) {
        return { error: "La lista contiene un tipo de enlace desconocido" };
    }

    if (new Set(allowedTypes).size !== allowedTypes.length) {
        return { error: "La lista de tipos permitidos contiene duplicados" };
    }

    if (!LINK_RULE_MODES.has(mode)) {
        return { error: "El modo de la regla es inválido" };
    }

    if (enabled !== undefined && typeof enabled !== "boolean") {
        return { error: "El estado de la regla es inválido" };
    }

    return {
        value: {
            serverId: serverId.trim(),
            channelId: channelId.trim(),
            type,
            allowedTypes: [...allowedTypes],
            mode,
            ...(enabled === undefined ? {} : { enabled }),
        }
    };
};

const sendPersistenceError = (res, error) => {
    if (error.code === "P2002") {
        return res.status(409).json({
            message: "Ya existe una regla de ese tipo para el servidor y canal"
        });
    }

    if (error.code === "P2025") {
        return res.status(404).json({
            message: "No se encontró la regla de canal"
        });
    }

    console.error("Error al guardar la regla de canal", error);
    return res.status(500).json({
        message: "No se pudo guardar la regla de canal"
    });
};

const createChannelRuleController = (channelRuleDb = defaultChannelRuleDb) => {
    const getChannelRules = async (req, res) => {
        const { serverId } = req.query;

        if (!isRequiredString(serverId)) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        try {
            const rules = await channelRuleDb.GetByServerId(serverId.trim());
            return res.status(200).json({ data: rules });
        } catch (error) {
            console.error("No se pudieron obtener las reglas de canal", error);
            return res.status(500).json({
                message: "No se pudieron obtener las reglas de canal"
            });
        }
    };

    const createChannelRule = async (req, res) => {
        const validation = validateRuleBody(req.body);

        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        try {
            const created = await channelRuleDb.Create(validation.value);
            return res.status(201).json({
                message: "Regla de canal creada con éxito",
                data: created,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateChannelRule = async (req, res) => {
        const { id } = req.params;

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id de la regla es requerido" });
        }

        const validation = validateRuleBody(req.body);
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        try {
            const updated = await channelRuleDb.Update(id, validation.value);
            return res.status(200).json({
                message: "Regla de canal editada con éxito",
                data: updated,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateChannelRuleEnabled = async (req, res) => {
        const { id } = req.params;
        const { enabled } = req.body ?? {};

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id de la regla es requerido" });
        }

        if (typeof enabled !== "boolean") {
            return res.status(400).json({ message: "El estado de la regla es inválido" });
        }

        try {
            const updated = await channelRuleDb.UpdateStatus(id, enabled);
            return res.status(200).json({
                message: enabled ? "Regla de canal activada" : "Regla de canal desactivada",
                data: updated,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const deleteChannelRule = async (req, res) => {
        const { id } = req.params;

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id de la regla es requerido" });
        }

        try {
            const deleted = await channelRuleDb.Delete(id);
            return res.status(200).json({
                message: "Regla de canal eliminada",
                data: deleted,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    return {
        getChannelRules,
        createChannelRule,
        updateChannelRule,
        updateChannelRuleEnabled,
        deleteChannelRule,
    };
};

const controller = createChannelRuleController();

module.exports = {
    ...controller,
    createChannelRuleController,
    validateRuleBody,
};
