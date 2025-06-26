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
            // await apagarInteraccion(interaction);
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
            const msj = lib.TicketForm(client, interaction);
            await apagarInteraccion(interaction, msj, true);
        }
    }

    if (interaction.customId.includes('dropdown_ticket-')) {
        lib.setTicketStatus(client, interaction);
    }

}

const apagarInteraccion = async (interaction, mensaje = null, limpiarComponentes = false) => {
    try {
        // Si no se ha respondido aún
        if (!interaction.replied && !interaction.deferred) {
            if (interaction.isMessageComponent()) {
                // Para botones o dropdowns
                await interaction.update({
                    content: mensaje || interaction.message.content,
                    components: limpiarComponentes ? [] : interaction.message.components,
                });
            } else {
                // Para slash commands o modales
                // await interaction.reply({
                //     content: mensaje || '✅ Acción completada.',
                //     ephemeral: true,
                // });
            }
        } else {
            // Ya fue respondida o deferida
            // if (mensaje) {
            //     if (interaction.deferred) {
            //         await interaction.editReply({ content: mensaje });
            //     } else {
            //         await interaction.followUp({
            //             content: mensaje,
            //             ephemeral: true
            //         });
            //     }
            // }

            // Borra el mensaje efímero si quieres
            if (interaction.ephemeral && interaction.deleteReply) {
                setTimeout(() => {
                    interaction.deleteReply().catch(() => {});
                }, 3000); // espera opcional
            }
        }
    } catch (error) {
        console.warn('⚠️ No se pudo apagar la interacción:', error);
    }
};

module.exports = {
    ManageInteraction,
}