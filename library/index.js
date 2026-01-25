const { Birthday, BirthdaySetup } = require("../db");

class Library {
    constructor() {

    }

    /**
     * 
     * @param {*} interaction 
     * @param {String} titleChannel 
     * @param {String} reason 
     * @param {String} topic 
     * @param {Array} permissionOverwrites 
     * @param {*} typeChannel 
     * @param {*} category 
     * @returns channel
     */
    async CreateChannel(interaction, titleChannel, reason, topic, permissionOverwrites, typeChannel, category) {

        const channel = await interaction.guild.channels.create({
            name: titleChannel,
            type: typeChannel,
            parent: category.id,
            topic: topic,
            permissionOverwrites: permissionOverwrites,
            reason: reason,
        });

        return {
            category: category,
            channel: channel,
        }
    }

    /**
     * 
     * @param {*} interaction 
     * @param {String} titleCategory 
     * @param {String} titleChannel 
     * @param {String} reasonChannel 
     * @param {String} reasonCategory 
     * @param {String} topic 
     * @param {Array} permissionOverwrites 
     * @param {*} typeChannel 
     * @returns channel, category
     */

    async CreateChannelWithCategory(interaction, titleCategory, titleChannel, reasonChannel, reasonCategory, topic, permissionOverwrites, typeChannel, typeCategory) {

        const category = await interaction.guild.channels.create({
            name: titleCategory,
            type: typeCategory,
            permissionOverwrites: permissionOverwrites,
            reason: reasonCategory,
        });

        const channel = await interaction.guild.channels.create({
            name: titleChannel,
            type: typeChannel,
            parent: category.id,
            topic: topic,
            permissionOverwrites: permissionOverwrites,
            reason: reasonChannel,
        });

        return {
            category: category,
            channel: channel,
        }
    }
}

const birthday = new Birthday();
const birthday_setup = new BirthdaySetup();

class RUNTIME_BOT {
    constructor() {
    }

    async birthday_runtime(client) {
        const bd_servers = await birthday_setup.Get();

        bd_servers.map(async (bds) => {
            const guild = await client.guilds.fetch(bds.serverId);
            // console.log(typeof (guild));
            let users = await birthday.GetById(guild.id);
            console.log(users);
            users.map(async (user) => {
                console.log('start');
                const { day, month, userId, age } = user;
                const dateUser = new Date(`2025-${month}-${day}T00:00:00Z`);
                const date = new Date();
                console.log(dateUser.getDate() + 1, date.getDate());
                if (dateUser.getDate() + 1 == date.getDate() && dateUser.getMonth() == date.getMonth()) {
                    // const member = await guild.members.fetch(userId);
                    const channel = await guild.channels.fetch(bds.channelId);
                    channel.send(bds.message.replace('$nombre', ` <@${userId}> `).replace('$edad', age == 0 ? '**' : age));
                    console.log(bds);
                }
                else {
                    console.log('not match')
                }
            })
        })
    }
}

module.exports = {
    Library,
    RUNTIME_BOT
};