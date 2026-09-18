const { Gifs, Interaction } = require("../../db");
const fs = require("fs").promises;

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

    async syncGif(serverId) {
        let directory = await fs.readdir("./static");
        let dir = directory.filter(d => d !== 'sin clasificar' && !d.includes(".sh"));
        directory = dir;
        // console.log(dir);

        let getInteraction = await db_interaction.getInteractionByNameAndServer(dir[0], serverId);

        if (getInteraction.length == 0) {
            return;
        }

        for (const d of directory) {

            const gifs = [];

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

            // console.log(d, gifs);

            gifs.forEach(async g => {
                // await db_gif.createGifByName(g.order, serverId, g.url, d);
            })

        }
    }

}

module.exports = {
    Util
}