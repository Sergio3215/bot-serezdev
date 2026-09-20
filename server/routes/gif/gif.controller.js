const { Interaction, Gifs } = require("../../../db/index");
const { Util } = require("../../../commands/util/index");

const db_interaction = new Interaction();
const db_gif = new Gifs();
const util = new Util();

const syncGif = async (req, res) => {
    try {
        // if (!process.env.ReSync) {
        //     return res.status(401).send("No se permite volver a re usar este endpoint");
        // }

        // Este proceso no tiene el cliente de discord.js, así que la lista de
        // servidores sale de la API REST. El sync en sí es el mismo que usan el
        // guildCreate y el cron: Util.syncGif.
        const ftch = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: {
                "Authorization": `Bot ${process.env.token}`
            }
        });

        if (!ftch.ok) {
            return res.status(502).json({ message: `Discord respondió ${ftch.status}` });
        }

        const servers = await ftch.json();
        const serversId = servers.map(s => s.id);

        const creados = await util.syncGifServers(serversId);

        res.json({ message: "Sync terminado", servidores: serversId.length, gifs: creados });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getInteractions = async (req, res) => {
    try {
        const interactions = await db_interaction.getInteractions();
        res.json({ data: interactions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getInteractionByName = async (req, res) => {
    try {
        const { name, serverId } = req.query;
        // console.log(name);

        const interaction = await db_interaction.getInteractionByNameAndServer(name, serverId);
        res.json({ data: interaction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addGif = async (req, res) => {
    const { inter, serverId, url } = req.body;

    try {
        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const regex = new RegExp(expression);

        if (!(url && url.match(regex))) {
            throw new Error("No es un enlace real");
        }
        if (inter === "") {
            throw new Error("No existe la interación");
        }
        if (serverId === "") {
            throw new Error("No existe el servidor");
        }

        const gifs = await db_gif.getGifsByInteraction(serverId, inter);
        const order = (gifs && gifs.length > 0 && gifs[0].order !== undefined) ? gifs[0].order + 1 : 1;

        // console.log(order);

        await db_gif.createGiftByInteractionId(order, serverId, url, inter);

        res.status(201).json({ message: "Se subio la imagen con exito" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const editGif = async (req, res) => {
    try {
        const { id, url } = req.body;
        await db_gif.updateGift(id, url);
        res.status(200).send("Editado");
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteGif = async (req, res) => {
    try {
        const { id } = req.body;
        await db_gif.deleteGift(id);
        res.status(200).send("Borrado");
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Borra todos los gifs de un servidor. Las interacciones no se tocan: son
 * globales. Un sync posterior (cron, guildCreate o /syncGif) los vuelve a crear
 * desde ./static, así que esto sirve para dejar un servidor en cero y repoblarlo.
 */
const deleteGifsByServer = async (req, res) => {
    try {
        const { serverId } = req.body;

        // Sin este control, un body vacío borraría los gifs de serverId undefined;
        // hoy no borra nada, pero no es algo que quieras dejar librado al azar.
        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const borrados = await db_gif.deleteByServer(serverId);

        res.status(200).json({
            message: `Se borraron ${borrados} gifs del servidor ${serverId}`,
            gifs: borrados
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    syncGif,
    deleteGifsByServer,
    getInteractions,
    getInteractionByName,
    addGif,
    editGif,
    deleteGif
};
