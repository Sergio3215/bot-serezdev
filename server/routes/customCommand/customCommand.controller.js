const { CustomCommand } = require("../../../db/index");

const defaultCustomCommandDb = new CustomCommand();
const DESCRIPTION_MAX_LENGTH = 100;

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

function createCustomCommandController(customCommandDb = defaultCustomCommandDb) {
    const getCustomCommands = async (req, res) => {
        const { serverId } = req.query;

        if (!isRequiredString(serverId)) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        try {
            const commands = await customCommandDb.GetByServerId(serverId);
            return res.status(200).json({ data: commands });
        } catch (error) {
            console.error("No se pudieron obtener los comandos personalizados", error);
            return res.status(500).json({
                message: "No se pudieron obtener los comandos personalizados"
            });
        }
    };

    const createCustomCommand = async (req, res) => {
        const { serverId, command, code, description, enabled } = req.body;

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

        try {
            const created = await customCommandDb.Create({
                serverId,
                command,
                code,
                description: descriptionValidation.value,
                enabled,
            });

            return res.status(201).json({
                message: "Comando personalizado creado con éxito",
                data: created,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    const updateCustomCommand = async (req, res) => {
        const { id } = req.params;
        const { command, code, description } = req.body;

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

        try {
            const updated = await customCommandDb.Update(id, {
                command,
                code,
                description: descriptionValidation.value,
            });

            return res.status(200).json({
                message: "Comando personalizado editado con éxito",
                data: updated,
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
                data: updated,
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
                data: deleted,
            });
        } catch (error) {
            return sendPersistenceError(res, error);
        }
    };

    return {
        getCustomCommands,
        createCustomCommand,
        updateCustomCommand,
        updateCustomCommandStatus,
        deleteCustomCommand,
    };
}

const controller = createCustomCommandController();

module.exports = {
    ...controller,
    createCustomCommandController,
    validateDescription,
};
