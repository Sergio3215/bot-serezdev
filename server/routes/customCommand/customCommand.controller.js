const { CustomCommand } = require("../../../db/index");
const {
    PreviewCustomCommand,
    ValidatePreviewInput,
} = require("../../../commands/custom/preview.js");

const defaultCustomCommandDb = new CustomCommand();
const DESCRIPTION_MAX_LENGTH = 100;
const ALLOWED_ROLE_IDS_MAX_LENGTH = 50;
const VALID_TRIGGER_TYPES = Object.freeze([
    "exact",
    "startsWith",
    "endsWith",
    "include",
]);
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

const isRequiredString = (value) =>
    typeof value === "string" && value.trim().length > 0;

const validateDescription = (description) => {
    if (description === undefined || description === null) {
        return { value: description };
    }

    if (typeof description !== "string") {
        return { error: "La descripción debe ser texto" };
    }

    const value = description.trim();
    if (value.length > DESCRIPTION_MAX_LENGTH) {
        return {
            error: `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres`,
        };
    }

    return { value };
};

const validateTriggerType = (triggerType) => {
    const value = triggerType ?? "include";

    if (!VALID_TRIGGER_TYPES.includes(value)) {
        return { error: "El tipo de trigger es inválido" };
    }

    return { value };
};

const validateAllowedRoleIds = (allowedRoleIds) => {
    const value = allowedRoleIds ?? [];

    if (!Array.isArray(value)) {
        return { error: "Los roles permitidos deben ser un array" };
    }

    if (
        value.some((roleId) => (
            typeof roleId !== "string"
            || roleId.length === 0
            || roleId.trim() !== roleId
            || !SNOWFLAKE_PATTERN.test(roleId)
        ))
    ) {
        return { error: "Cada rol permitido debe ser un snowflake válido" };
    }

    const normalized = [...new Set(value)];
    if (normalized.length > ALLOWED_ROLE_IDS_MAX_LENGTH) {
        return {
            error: `No se pueden configurar más de ${ALLOWED_ROLE_IDS_MAX_LENGTH} roles`,
        };
    }

    return { value: normalized };
};

const validateCustomCommandAccess = ({ triggerType, allowedRoleIds }) => {
    const triggerValidation = validateTriggerType(triggerType);
    if (triggerValidation.error) return triggerValidation;

    const rolesValidation = validateAllowedRoleIds(allowedRoleIds);
    if (rolesValidation.error) return rolesValidation;

    return {
        value: {
            triggerType: triggerValidation.value,
            allowedRoleIds: rolesValidation.value,
        },
    };
};

const normalizeCustomCommandRecord = (command) => {
    if (!command || typeof command !== "object") return command;

    return {
        ...command,
        triggerType: VALID_TRIGGER_TYPES.includes(command.triggerType)
            ? command.triggerType
            : "include",
        allowedRoleIds: Array.isArray(command.allowedRoleIds)
            ? [...new Set(command.allowedRoleIds.filter(
                (roleId) => typeof roleId === "string" && roleId.length > 0,
            ))]
            : [],
    };
};

function sendPersistenceError(res, error) {
    if (error.code === "P2002") {
        return res.status(409).json({
            message: "Ya existe ese comando personalizado en el servidor"
        });
    }

    if (error.code === "P2025") {
        return res.status(404).json({
            message: "No se encontró el comando personalizado"
        });
    }

    console.error("Error al guardar el comando personalizado", error);
    return res.status(500).json({
        message: "No se pudo guardar el comando personalizado"
    });
}

function createCustomCommandController(
    customCommandDb = defaultCustomCommandDb,
    previewCustomCommand = PreviewCustomCommand,
) {
    const getCustomCommands = async (req, res) => {
        const { serverId } = req.query;

        if (!isRequiredString(serverId)) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        try {
            const commands = await customCommandDb.GetByServerId(serverId);
            return res.status(200).json({
                data: commands.map(normalizeCustomCommandRecord),
            });
        } catch (error) {
            console.error("No se pudieron obtener los comandos personalizados", error);
            return res.status(500).json({
                message: "No se pudieron obtener los comandos personalizados"
            });
        }
    };

    const createCustomCommand = async (req, res) => {
        const {
            serverId,
            command,
            triggerType,
            code,
            description,
            allowedRoleIds,
            enabled,
        } = req.body;

        if (!isRequiredString(serverId)) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        if (!isRequiredString(command)) {
            return res.status(400).json({ message: "El comando es requerido" });
        }

        if (!isRequiredString(code)) {
            return res.status(400).json({ message: "El código embebido es requerido" });
        }

        if (enabled !== undefined && typeof enabled !== "boolean") {
            return res.status(400).json({ message: "El estado del comando es inválido" });
        }

        const descriptionValidation = validateDescription(description);
        if (descriptionValidation.error) {
            return res.status(400).json({ message: descriptionValidation.error });
        }

        const accessValidation = validateCustomCommandAccess({
            triggerType,
            allowedRoleIds,
        });
        if (accessValidation.error) {
            return res.status(400).json({ message: accessValidation.error });
        }

        try {
            const created = await customCommandDb.Create({
                serverId,
                command,
                triggerType: accessValidation.value.triggerType,
                code,
                description: descriptionValidation.value,
                allowedRoleIds: accessValidation.value.allowedRoleIds,
                enabled,
            });

            return res.status(201).json({
                message: "Comando personalizado creado con éxito",
                data: normalizeCustomCommandRecord(created),
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateCustomCommand = async (req, res) => {
        const { id } = req.params;
        const {
            command,
            triggerType,
            code,
            description,
            allowedRoleIds,
        } = req.body;

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id del comando es requerido" });
        }

        if (!isRequiredString(command)) {
            return res.status(400).json({ message: "El comando es requerido" });
        }

        if (!isRequiredString(code)) {
            return res.status(400).json({ message: "El código embebido es requerido" });
        }

        const descriptionValidation = validateDescription(description);
        if (descriptionValidation.error) {
            return res.status(400).json({ message: descriptionValidation.error });
        }

        const accessValidation = validateCustomCommandAccess({
            triggerType,
            allowedRoleIds,
        });
        if (accessValidation.error) {
            return res.status(400).json({ message: accessValidation.error });
        }

        try {
            const updated = await customCommandDb.Update(id, {
                command,
                triggerType: accessValidation.value.triggerType,
                code,
                description: descriptionValidation.value,
                allowedRoleIds: accessValidation.value.allowedRoleIds,
            });

            return res.status(200).json({
                message: "Comando personalizado editado con éxito",
                data: normalizeCustomCommandRecord(updated),
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateCustomCommandStatus = async (req, res) => {
        const { id } = req.params;
        const { enabled } = req.body;

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id del comando es requerido" });
        }

        if (typeof enabled !== "boolean") {
            return res.status(400).json({ message: "El estado del comando es inválido" });
        }

        try {
            const updated = await customCommandDb.UpdateStatus(id, enabled);

            return res.status(200).json({
                message: enabled
                    ? "Comando personalizado activado con éxito"
                    : "Comando personalizado desactivado con éxito",
                data: normalizeCustomCommandRecord(updated),
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const deleteCustomCommand = async (req, res) => {
        const { id } = req.params;

        if (!isRequiredString(id)) {
            return res.status(400).json({ message: "El id del comando es requerido" });
        }

        try {
            const deleted = await customCommandDb.Delete(id);

            return res.status(200).json({
                message: "Comando personalizado borrado con éxito",
                data: normalizeCustomCommandRecord(deleted),
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const previewCustomCommandRequest = async (req, res) => {
        const { serverId, code, message, mention } = req.body ?? {};

        const validation = ValidatePreviewInput({ serverId, code, message });
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        try {
            const preview = await previewCustomCommand({
                serverId,
                code,
                message,
                mention: mention === true,
            });

            return res.status(200).json({ data: preview });
        } catch (error) {
            console.error("No se pudo probar el comando personalizado", error);
            return res.status(500).json({
                message: "No se pudo probar el comando personalizado"
            });
        }
    };

    return {
        getCustomCommands,
        createCustomCommand,
        updateCustomCommand,
        updateCustomCommandStatus,
        deleteCustomCommand,
        previewCustomCommand: previewCustomCommandRequest,
    };
}

const controller = createCustomCommandController();

module.exports = {
    ...controller,
    createCustomCommandController,
    validateDescription,
    validateTriggerType,
    validateAllowedRoleIds,
    validateCustomCommandAccess,
    normalizeCustomCommandRecord,
    VALID_TRIGGER_TYPES,
    ALLOWED_ROLE_IDS_MAX_LENGTH,
};
