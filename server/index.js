const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");

const { Interaction } = require('../db/index');

const db_interaction = new Interaction();

const app = express();

require("dotenv").config();

app.use(cors({
    origin: "*"
}));

app.post('/api/v1/syncGif', async (req, res) => {

    if (!process.env.ReSync) {
        res.status(401).send("No se permite volver a re usar este endpoint");
    }

    let directory = await fs.readdir("./static");
    let dir = directory.filter(d => d !== 'sin clasificar' && !d.includes(".sh"));
    directory = dir;

    let ftch = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
            "Authorization": `Bot ${process.env.token}`
        }
    });
    const servers = await ftch.json();

    const serversId = servers.map(s => s.id);

    console.log(serversId);

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

        console.log(d, gifs);

        // await db_interaction.createInteractionAndGifs(gifs, d);
    }

    res.send("todo ok")
});

app.get("/api/v1/getInteractions", async (req, res) => {
    const interactions = await db_interaction.getInteractions();
    res.json({ data: interactions })
})


app.get("/api/v1/getInteractionByName", async (req, res) => {
    const { name, serverId } = req.query;
    console.log(name);

    const interaction = await db_interaction.getInteractionByNameAndServer(name, serverId);

    res.json({ data: interaction });
})



app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});