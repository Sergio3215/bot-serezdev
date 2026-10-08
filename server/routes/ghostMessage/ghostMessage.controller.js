const { GhostMessageRepository } = require("../../../commands/ghostMessage/repository.js");
const { AutoCleanMessageRepository } = require("../../../commands/autoCleanMessage/repository.js");
const { ValidateGhostMessagePayload } = require("../../../commands/ghostMessage/validator.js");
const { ValidateSnowflake } = require("../../../commands/messageCleanup/validator.js");

const defaultRepository = new GhostMessageRepository();
const defaultConflictingRepository = new AutoCleanMessageRepository();

const SendPersistenceError = (res, error) => {
    if (error?.code === "P2025") {
        return res.status(404).json({ message: "No se encontró la configuración Ghost Message" });
    }
    if (error?.code === "P2002") {
        return res.status(409).json({ message: "El canal ya posee una configuración Ghost Message" });
    }
    console.error("No se pudo guardar Ghost Message", error);
    return res.status(500).json({ message: "No se pudo guardar Ghost Message" });
};

const SendCrossFeatureConflict = (res) => res.status(409).json({
    message: "El canal ya posee una configuración Auto Clean Message",
});

const CreateGhostMessageController = ({
    repository = defaultRepository,
    conflictingRepository = defaultConflictingRepository,
} = {}) => {
    const assertNoAutoCleanConflict = async (configuration) => (
        !await conflictingRepository.ExistsForChannel(
            configuration.serverId,
            configuration.channelId,
        )
    );

    const getAll = async (req, res) => {
        const validation = ValidateSnowflake(req.query?.serverId, "El id del servidor");
        if (validation.error) return res.status(400).json({ message: validation.error });
        try {
            return res.status(200).json({
                data: await repository.GetByServerId(validation.value),
            });
        } catch (error) {
            console.error("No se pudo listar Ghost Message", error);
            return res.status(500).json({ message: "No se pudo listar Ghost Message" });
        }
    };

    const create = async (req, res) => {
        const validation = ValidateGhostMessagePayload(req.body);
        if (validation.error) return res.status(400).json({ message: validation.error });
        try {
            if (!await assertNoAutoCleanConflict(validation.value)) {
                return SendCrossFeatureConflict(res);
            }
            const created = await repository.Create(validation.value);
            return res.status(201).json({ message: "Ghost Message creado", data: created });
        } catch (error) {
            return SendPersistenceError(res, error);
        }
    };

    const update = async (req, res) => {
        if (typeof req.params?.id !== "string" || req.params.id.length === 0) {
            return res.status(400).json({ message: "El id es requerido" });
        }
        const validation = ValidateGhostMessagePayload(req.body);
        if (validation.error) return res.status(400).json({ message: validation.error });
        try {
            const current = await repository.GetById(req.params.id);
            if (!current) {
                const error = new Error("missing");
                error.code = "P2025";
                throw error;
            }
            if (!await assertNoAutoCleanConflict(validation.value)) {
                return SendCrossFeatureConflict(res);
            }
            const updated = await repository.Update(req.params.id, validation.value);
            return res.status(200).json({ message: "Ghost Message actualizado", data: updated });
        } catch (error) {
            return SendPersistenceError(res, error);
        }
    };

    const updateStatus = async (req, res) => {
        if (typeof req.params?.id !== "string" || req.params.id.length === 0) {
            return res.status(400).json({ message: "El id es requerido" });
        }
        if (typeof req.body?.enabled !== "boolean" || Object.keys(req.body).length !== 1) {
            return res.status(400).json({ message: "enabled debe ser el único campo y ser boolean" });
        }
        try {
            const current = await repository.GetById(req.params.id);
            if (!current) {
                const error = new Error("missing");
                error.code = "P2025";
                throw error;
            }
            if (req.body.enabled && !await assertNoAutoCleanConflict(current)) {
                return SendCrossFeatureConflict(res);
            }
            const updated = await repository.UpdateStatus(req.params.id, req.body.enabled);
            return res.status(200).json({ message: "Estado Ghost Message actualizado", data: updated });
        } catch (error) {
            return SendPersistenceError(res, error);
        }
    };

    const remove = async (req, res) => {
        if (typeof req.params?.id !== "string" || req.params.id.length === 0) {
            return res.status(400).json({ message: "El id es requerido" });
        }
        try {
            return res.status(200).json({
                message: "Ghost Message eliminado",
                data: await repository.Delete(req.params.id),
            });
        } catch (error) {
            return SendPersistenceError(res, error);
        }
    };

    return { getAll, create, update, updateStatus, remove };
};

const controller = CreateGhostMessageController();
module.exports = {
    ...controller,
    CreateGhostMessageController,
    SendPersistenceError,
};
