const { MessageFlags } = require('discord.js');
const { buttonFollowing, aceptRules } = require("../db");

const { interactionLib } = require("./lib.js");

const btnfollow = new buttonFollowing();
const acept_rules = new aceptRules();

const lib = new interactionLib();

/**
 * Único punto de entrada de botones, menús y modales.
 *
 * Cada rama corta con `return`. Antes eran `if` sueltos que comparaban con
 * `customId.includes(...)`: dos ramas podían dispararse sobre la misma interacción y la
 * segunda moría con InteractionAlreadyReplied.
 */
const ManageInteraction = async (client, interaction) => {
    try {
        if (interaction.isButton()) {
            return await botones(client, interaction);
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('dropdown_ticket-')) {
                return await lib.setTicketStatus(client, interaction);
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'ticket_form') {
                return await lib.TicketForm(client, interaction);
            }

            if (interaction.customId.startsWith('closeTicket-')) {
                return await lib.closeTicket(client, interaction);
            }
            return;
        }
    } catch (error) {
        // 40060: alguien ya respondió esta interacción. Si el proceso es uno solo no
        // debería pasar nunca; si pasa, casi siempre hay dos instancias del bot
        // conectadas con el mismo token y las dos atienden el mismo evento. No tiene
        // sentido ni el stack completo ni intentar contestar: la interacción ya se fue.
        if (error.code === 40060) {
            console.warn(`La interacción "${interaction.customId}" ya había sido respondida (40060). ¿Hay otra instancia del bot corriendo?`);
            return;
        }

        console.error(`Error manejando la interacción "${interaction.customId}":`, error);
        await avisarDelError(interaction);
    }
};

const botones = async (client, interaction) => {
    const id = interaction.customId;

    if (id === 'open_ticket') {
        return await lib.BtnTicket(interaction);
    }

    if (id.startsWith('Tkt-')) {
        return await lib.TicketShowed(client, interaction);
    }

    // El canal viaja dentro del customId: un botón viejo, de un canal que ya no es el
    // configurado, se ignora en lugar de asignar el rol equivocado.
    if (id.startsWith('Following ')) {
        const dto = (await btnfollow.GetById(interaction.guild.id))[0];

        if (!dto || id !== `Following ${dto.setChannel}`) return;

        return await lib.BtnFollowing(interaction, dto.setRole, dto.setChannel);
    }

    if (id.startsWith('Rules ')) {
        const dto = (await acept_rules.GetById(interaction.guild.id))[0];

        if (!dto || id !== `Rules ${dto.setChannel}`) return;

        return await lib.BtnRules(interaction, dto.setRole, dto.removeRole, dto.setChannel);
    }
};

/** Que el usuario vea algo cuando el handler explota, en vez del error genérico de Discord. */
const avisarDelError = async (interaction) => {
    const aviso = {
        content: 'Algo falló procesando esta acción. Intentalo de nuevo.',
        flags: MessageFlags.Ephemeral
    };

    try {
        if (interaction.deferred) {
            await interaction.followUp(aviso);
        }
        else if (!interaction.replied) {
            await interaction.reply(aviso);
        }
    } catch (error) {
        // La interacción ya venció o fue respondida por otro lado: no hay nada que hacer.
    }
};

module.exports = {
    ManageInteraction,
}
