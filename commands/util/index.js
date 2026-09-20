const { Gifs, Interaction } = require("../../db");
const fs = require("fs").promises;
const path = require("path");

// Ruta fija a ./static: el sync lo llaman el bot y el servidor de la API, que son
// procesos distintos, y una ruta relativa dependería del cwd de cada uno.
const CARPETA_STATIC = path.join(__dirname, "..", "..", "static");

const db_gif = new Gifs();
const db_interaction = new Interaction();

class Util {
    constructor() { }

    async PersonaRandom(client, msg) {

        let letter = 'a';
        let arrLetter = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

        letter = arrLetter[Math.floor(Math.random() * arrLetter.length)];
        // console.log(letter);

        const guild = await client.guilds.cache.get(msg.guild.id);
        // console.log(guild);
        let member = await guild.members.search({ query: letter, limit: 100 });
        // console.log(member.size);
        // console.log(member.filter(m => m.user.bot !== true));

        if (member.size !== 0) {
            let tempArr = [];
            member.filter(m => m.user.bot !== true).map(m => {

                if (m.user.globalName == null) {
                    m.user.globalName = m.user.username;
                }

                tempArr.push(m);
            })

            let oneMember = Math.floor(Math.random() * tempArr.length);

            // console.log(tempArr[oneMember].nickname);
            // console.log(tempArr[oneMember].user.globalName);

            return tempArr[oneMember]
        }
        else {
            return this.PersonaRandom(client, msg);
        }
    }

    getCommentAndReciver(msg, percent, message) {
        let reciver = msg.author.id;
        let comment = '';

        if (percent > 50) {
            comment = message;
        }

        if (msg.content.includes('<@')) {
            reciver = msg.content.split('<@')[1].split('>')[0];
        }

        return {
            reciver,
            comment
        }
    }

    ColorRandom(Colors) {
        let num = Math.floor(Math.random() * 4);

        if (num == 0) {
            num = 1;
        }

        switch (num) {
            case 1:
                return Colors.Red;
                break;
            case 2:
                return Colors.Green;
                break;
            case 3:
                return Colors.Blue;
                break;
            case 4:
                return Colors.Black;
                break;
        }
    }

    /**
     * Copia a un servidor los gifs de ./static que todavía no tenga.
     *
     * Es la única implementación del sync: la usan el guildCreate (un id), el cron
     * (todos los servidores) y el endpoint /api/v1/gif/syncGif. Lo único que cambia
     * entre los tres es de dónde sale la lista de ids.
     *
     * @param {String} serverId
     * @returns {Promise<Number>} cuántos gifs se crearon
     */
    async syncGif(serverId) {
        const directory = (await fs.readdir(CARPETA_STATIC))
            .filter(d => d !== 'sin clasificar' && !d.includes(".sh"));

        // Una sola lectura de las interacciones para todo el sync, en vez de releer la
        // colección entera por cada gif (son ~475 por servidor).
        const interacciones = await db_interaction.getInteractions();
        const idPorNombre = new Map(interacciones.map(i => [i.name, i.id]));

        let creados = 0;

        for (const d of directory) {
            const interactionId = idPorNombre.get(d);

            if (!interactionId) {
                console.log(`[syncGif] no existe la interacción "${d}", se omite esa carpeta`);
                continue;
            }

            // Se pregunta por carpeta y no por servidor entero: así un servidor que ya
            // tiene gifs igual recibe las carpetas nuevas que se agreguen a ./static,
            // que es justamente para lo que corre el cron. La consulta va acá afuera
            // porque si fuera por archivo, al crear el primero los demás verían la
            // carpeta ocupada y se saltearían.
            const existentes = await db_gif.getGifsByInteraction(serverId, interactionId);
            if (existentes.length > 0) continue;

            const files = (
                await fs.readdir(path.join(CARPETA_STATIC, d))
            ).filter(file => file.endsWith(".gif"));

            for (const file of files) {
                const order = parseInt(file.replace(".gif", ""));
                const url = `https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static/${d}/${file}`;

                try {
                    // En serie y con await: con forEach(async) la función terminaba antes
                    // que las escrituras y un sync cortado quedaba a medias sin aviso.
                    await db_gif.createGiftByInteractionId(order, serverId, url, interactionId);
                    creados++;
                } catch (error) {
                    // El índice único (serverId, interactionId, order) rechaza duplicados:
                    // es esperable si se reintenta, cualquier otra cosa sí importa.
                    if (error.code !== "P2002") {
                        console.log(`[syncGif] ${d}/${file}:`, error.message);
                    }
                }
            }
        }

        if (creados > 0) {
            console.log(`[syncGif] servidor ${serverId}: ${creados} gifs copiados`);
        }

        return creados;
    }

    /**
     * El mismo sync sobre una lista de servidores. Cada uno en su propio try: que
     * uno falle no puede cortar el resto de la corrida.
     *
     * @param {Array<String>} serverIds
     * @returns {Promise<Number>} total de gifs creados
     */
    async syncGifServers(serverIds) {
        let total = 0;

        for (const serverId of serverIds) {
            try {
                total += await this.syncGif(serverId);
            } catch (error) {
                console.log(`[syncGif] servidor ${serverId}:`, error.message);
            }
        }

        return total;
    }

}

module.exports = {
    Util
}