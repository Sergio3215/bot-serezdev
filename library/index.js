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
     * @returns 
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
     * @returns 
     */

    async CreateChannelWithCategory(interaction, titleCategory, titleChannel, reasonChannel, reasonCategory, topic, permissionOverwrites, typeChannel) {

        const category = await interaction.guild.channels.create({
            name: titleCategory,
            type: ChannelType.GuildCategory,
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

module.exports = {
    Library
};