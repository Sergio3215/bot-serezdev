const { SettingWelcome } = require("../../../db/index");

const setting_welcome = new SettingWelcome();

const getJoinServer = async (req, res) => {
    try {
        const { serverId } = req.query;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }
        const setup = await setting_welcome.GetById(serverId);
        return res.status(200).json({ data: setup });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const createJoinServer = async (req, res) => {
    try {
        const { serverId, roleId } = req.body;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const idRole = cleanRoleId(roleId);

        const result = await setting_welcome.Create(serverId, idRole);

        return res.status(201).json({ message: "Configuración de bienvenida creada con éxito", data: result });

    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const updateJoinServer = async (req, res) => {
    try {
        const { id, roleId } = req.body;

        if (!roleId) {
            return res.status(400).json({ message: "El id del rol es requerido" });
        }

        await setting_welcome.Update({
            id,
            role: roleId
        });

        return res.status(200).json({ message: "Configuración de bienvenida actualizada con éxito" });

    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getJoinServer,
    createJoinServer,
    updateJoinServer
};
