
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

    async BtnRules(interaction, set_rolId, remove_roleId, label_id) {

        interaction.member.roles.add(set_rolId);
        interaction.member.roles.remove(remove_roleId);

        interaction.reply({
            content: `Has aceptado las reglas del canal <#${label_id}>`,
            ephemeral: true
        });
    }
}

module.exports = {
    interactionLib,
}