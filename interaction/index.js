const { buttonFollowing, aceptRules } = require("../db");

const { interactionLib } = require("./lib.js");

const btnfollow = new buttonFollowing();
const acept_rules = new aceptRules();


const ManageInteraction = async (client, interaction) => {
    let lib = new interactionLib();

    if (interaction.isButton()) {
        if (interaction.customId.includes('Following')) {

            let dto = (await btnfollow.GetById(interaction.guild.id))[0];
            let label_id = dto.setChannel;

            if (interaction.customId.includes('Following ' + label_id)) {
                lib.BtnFollowing(interaction, dto.setRole, label_id);
            }
        }

        if (interaction.customId.includes('Rules')) {

            let dto = (await acept_rules.GetById(interaction.guild.id))[0];
            let label_id = dto.setChannel;

            if (interaction.customId.includes('Rules ' + label_id)) {
                lib.BtnRules(interaction, dto.setRole, dto.removeRole, label_id);
            }
        }

        if (interaction.customId.includes('open_ticket')) {
            lib.BtnTicket(interaction);
        }

        if (interaction.customId.includes('Tkt-')) {
            lib.TicketShowed(client, interaction);
        }
    }

    if (interaction.isModalSubmit()) {

        if (interaction.customId.includes('closeTicket-')) {
            lib.closeTicket(client, interaction);
        }
        if (interaction.customId === 'ticket_form') {
            lib.TicketForm(interaction);
        }
    }

    if (interaction.customId.includes('dropdown_ticket-')) {
        lib.setTicketStatus(client, interaction);
    }
}

module.exports = {
    ManageInteraction,
}