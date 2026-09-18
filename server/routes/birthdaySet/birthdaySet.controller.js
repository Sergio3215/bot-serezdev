const { BirthdaySetup } = require("../../../db/index");

const birthday_setup = new BirthdaySetup();

const getSetup = async (req, res) => {
    try {
        const { serverId } = req.query;

        const setup = await birthday_setup.GetById(serverId);
        return res.json({ data: setup });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const saveSetup = async (req, res) => {
    try {
        const { serverId, message } = req.body;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const setup = await birthday_setup.GetById(serverId);

        await birthday_setup.Update(serverId, {
            channelId: setup[0].channelId,
            message
        });

        return res.status(200).json({ message: "Configuración de cumpleaños actualizada" });

    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getSetup,
    saveSetup
};
