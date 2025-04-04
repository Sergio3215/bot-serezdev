
class interactionLib {
    constructor() {

    }

    async BtnFollowing(interaction, rolId, label_id) {

        interaction.member.roles.add(rolId);

        interaction.reply({
            content: `Has seguido el canal <#${label_id}>`,
            ephemeral: true
        });
    }
}

module.exports = {
    interactionLib,
}