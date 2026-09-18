const fs = require("fs").promises;
const { Interaction, Gifs } = require("../../../db/index");

const db_interaction = new Interaction();
const db_gif = new Gifs();

const syncGif = async (req, res) => {
    try {
        if (!process.env.ReSync) {
            return res.status(401).send("No se permite volver a re usar este endpoint");
        }

        let directory = await fs.readdir("./static");
        let dir = directory.filter(d => d !== "sin clasificar" && !d.includes(".sh"));
        directory = dir;

        let ftch = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: {
                "Authorization": `Bot ${process.env.token}`
            }
        });
        const servers = await ftch.json();

        const serversId = servers.map(s => s.id);

        // console.log(serversId);

        for (const d of directory) {
            const gifs = [];

            for (const serverId of serversId) {
                const files = (
                    await fs.readdir(`./static/${d}`)
                ).filter(file => file.endsWith(".gif"));

                for (const file of files) {
                    gifs.push({
                        order: parseInt(file.replace(".gif", "")),
                        serverId,
                        url: `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${d}/${file}`
                    });
                }
            }

            // console.log(d, gifs);
            // await db_interaction.createInteractionAndGifs(gifs, d);
        }

        res.send("todo ok");
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

module.exports = {
    syncGif,
    getInteractions,
    getInteractionByName,
    addGif,
    editGif,
    deleteGif
};
