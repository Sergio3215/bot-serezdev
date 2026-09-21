const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { setTicket, Ticket, statusTicket } = require('../db');

const set_ticket = new setTicket();
const ticket = new Ticket();
const status_ticket = new statusTicket();

/**
 * Regla que ordena todo este archivo: Discord da 3 segundos para acusar recibo de una
 * interacción. Como casi todos estos handlers pegan a Mongo antes de contestar, primero
 * se defiere (`deferReply` / `deferUpdate`) y recién después se trabaja.
 *
 * La excepción es `showModal`: tiene que ser la PRIMERA respuesta de la interacción, así
 * que las ramas que abren un modal no se pueden deferir.
 */
class interactionLib {
    constructor() {

    }

    async BtnFollowing(interaction, rolId, label_id) {

        try {
            await interaction.member.roles.add(rolId);
        } catch (error) {
            console.error('No se pudo asignar el rol de seguimiento:', error);

            await interaction.reply({
                content: 'No pude asignarte el rol. Avisale a un moderador que revise los permisos del bot.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.reply({
            content: `Has seguido el canal <#${label_id}>`,
            flags: MessageFlags.Ephemeral
        });
    }

    async BtnRules(interaction, set_rolId, remove_roleId, label_id) {

        try {
            await interaction.member.roles.add(set_rolId);

            if (remove_roleId) {
                await interaction.member.roles.remove(remove_roleId);
            }
        } catch (error) {
            console.error('No se pudieron cambiar los roles de reglas:', error);

            await interaction.reply({
                content: 'No pude cambiarte los roles. Avisale a un moderador que revise los permisos del bot.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.reply({
            content: `Has aceptado las reglas del canal <#${label_id}>`,
            flags: MessageFlags.Ephemeral
        });
    }

    async BtnTicket(interaction) {

        if (interaction.replied || interaction.deferred) {
            console.warn("Esta interacción ya fue respondida. No se puede mostrar el modal.");
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('ticket_form')
            .setTitle('Formulario de Ticket');

        const report = new TextInputBuilder()
            .setCustomId('report_message')
            .setLabel('¿Que problema tienes?')
            .setStyle(TextInputStyle.Paragraph)
            .setValue('')
            .setPlaceholder('Escribe aqui el problema que tienes');

        const row = new ActionRowBuilder().addComponents(report);
        modal.addComponents(row);
        await interaction.showModal(modal);
    }

    async TicketForm(client, interaction) {

        // Se defiere antes de tocar Mongo: entre el GetById, el Create, el send y el
        // Update no se entra en los 3 segundos que da Discord.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message = interaction.fields.getTextInputValue('report_message');

        const setup = (await set_ticket.GetById(interaction.guild.id))[0];

        if (!setup || !setup.pendingChannel) {
            await interaction.editReply({
                content: 'Este servidor todavía no tiene configurado el canal de gestión de tickets.'
            });
            return;
        }

        const channel = await interaction.guild.channels.fetch(setup.pendingChannel).catch(() => null);

        if (!channel) {
            await interaction.editReply({
                content: 'El canal de gestión de tickets ya no existe. Un moderador tiene que volver a configurarlo.'
            });
            return;
        }

        const dto = await ticket.Create({
            id: interaction.guild.id,
            userId: interaction.user.id,
            message: message,
        });

        const ticketId = dto.ticketId;

        const btn_ticket = new ButtonBuilder()
            .setCustomId('Tkt-' + ticketId)
            .setLabel('Abrir Ticket')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(btn_ticket);

        const enviado = await channel.send({
            content: `¿Deseas abrir un ticket?`,
            components: [row]
        });

        // El messageId se guarda aparte porque al cerrar el ticket hay que borrar ese
        // mensaje del canal de moderación.
        await ticket.Update({
            id: ticketId,
            messageId: enviado.id,
        });

        await this.#sendUserMessageTicket(client, interaction.user.id, ticketId, message, "Creado", this.#nombre(interaction.user), interaction.guild.name, "");

        await interaction.editReply({
            content: `Se ha creado un ticket con el número ${ticketId}`
        });
    }

    #nombre(user) {
        return user.globalName || user.username;
    }

    async #checkStatus(ticketId, save_status) {

        let open = false, inProgress = false, resolve = false, close = false;

        let status = (await status_ticket.GetById(ticketId));

        if (save_status !== undefined && save_status !== null) {
            status = [save_status];
        }

        if (status.length > 0) {
            switch (status[0].status) {
                case 'open':
                    open = true;
                    break;
                case 'in progress':
                    inProgress = true;
                    break;
                case 'resolve':
                    resolve = true;
                    break;
                case 'close':
                    close = true;
                    break;
                default:
                    break;
            }
        }
        else {
            const opt = {
                id: ticketId,
                status: 'open',
            }

            // El Create puede chocar contra el unique de ticketId si otra interacción
            // creó la fila en el medio: doble clic en "Abrir Ticket", o dos instancias
            // del bot conectadas con el mismo token atendiendo el mismo evento. En ese
            // caso la fila existe igual, así que se relee en lugar de reventar.
            try {
                await status_ticket.Create(opt);
                open = true;
            } catch (error) {
                const reintento = await status_ticket.GetById(ticketId);

                if (reintento.length === 0) throw error;

                status = reintento;

                switch (status[0].status) {
                    case 'in progress':
                        inProgress = true;
                        break;
                    case 'resolve':
                        resolve = true;
                        break;
                    case 'close':
                        close = true;
                        break;
                    default:
                        open = true;
                        break;
                }
            }
        }


        let arrOptions = [
            (open) ? { label: 'Abierto', value: 'open', default: true } : { label: 'Abierto', value: 'open' },
            (inProgress) ? { label: 'En Proceso', value: 'in progress', default: true } : { label: 'En Proceso', value: 'in progress' },
            (resolve) ? { label: 'Resuelto', value: 'resolve', default: true } : { label: 'Resuelto', value: 'resolve' },
            (close) ? { label: 'Cerrado', value: 'close', default: true } : { label: 'Cerrado', value: 'close' }
        ]

        return { arrOptions };
    }

    /**
     * El aviso por DM es "mejor esfuerzo": si el usuario tiene los privados cerrados,
     * `user.send` tira error. Antes eso mataba el handler entero y el moderador veía la
     * interacción fallada aunque el ticket se hubiera guardado bien.
     */
    async #sendUserMessageTicket(client, userId, ticketId, message, status, remited, guild, result) {
        try {
            const user = await client.users.fetch(userId);

            await user.send({
                content: `**Ticket #${ticketId}** \n El ticket con el siguiente mensaje:\n **${message}** ${(result == "") ? "" : `\n Resultado del Ticket:\n${result}`} \n Tiene un estado de **${status}** \n Estado del ticket remitido por **${remited}** en el servidor **${guild}**`,
            });
        } catch (error) {
            console.warn(`No se pudo avisar por DM del ticket #${ticketId} al usuario ${userId}:`, error.message);
        }
    }


    async #labelStatus(status) {

        let label = 'Abierto';

        switch (status) {
            case 'open':
                label = 'Abierto';
                break;
            case 'in progress':
                label = 'En Proceso';
                break;
            case 'resolve':
                label = 'Resuelto';
                break;
            case 'close':
                label = 'Cerrado';
                break;
            default:
                break;
        }

        return { label };
    }

    async TicketShowed(client, interaction) {
        await interaction.deferUpdate();

        const ticketId = parseInt(interaction.customId.split('-')[1]);
        const dto = (await ticket.GetById(ticketId))[0];

        if (!dto) {
            await interaction.followUp({
                content: `El ticket #${ticketId} ya no existe.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const { arrOptions } = await this.#checkStatus(ticketId);

        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('dropdown_ticket-' + ticketId)
            .setPlaceholder('Elige una categoría')
            .addOptions(arrOptions);

        const row = new ActionRowBuilder()
            .addComponents(dropdown);

        await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, "Abierto", this.#nombre(interaction.user), interaction.guild.name, "");

        await interaction.editReply({
            content: `Ticket #${ticketId} \n Ticket generado por: <@${dto.userId}> \n ${dto.message} \n Estado del ticket`,
            components: [row],
        });
    }


    async setTicketStatus(client, interaction) {
        const ticketId = parseInt(interaction.customId.split('-')[1]);
        const nuevoEstado = interaction.values[0];

        // "Cerrar" abre un modal, y un modal no se puede mostrar después de deferir. Por
        // eso la rama se decide antes de tocar la base de datos.
        if (nuevoEstado === 'close') {
            const modal = new ModalBuilder()
                .setCustomId('closeTicket-' + ticketId)
                .setTitle('¿Quieres cerrar el ticket?');

            const result = new TextInputBuilder()
                .setCustomId('result_message')
                .setLabel('Resolucion')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Escribe aqui la resolución')
                .setValue('')
                .setRequired(false);

            const row = new ActionRowBuilder().addComponents(result);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return;
        }

        await interaction.deferUpdate();

        const dto = (await ticket.GetById(ticketId))[0];

        if (!dto) {
            await interaction.followUp({
                content: `El ticket #${ticketId} ya no existe.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // #checkStatus crea la fila de estado si todavía no existe, así que va antes del
        // Update: de lo contrario Prisma no encuentra el registro y revienta.
        await this.#checkStatus(ticketId);

        await status_ticket.Update({
            id: ticketId,
            status: nuevoEstado,
        });

        const { arrOptions } = await this.#checkStatus(ticketId);

        const { label } = await this.#labelStatus(nuevoEstado);

        await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, label, this.#nombre(interaction.user), interaction.guild.name, "");

        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('dropdown_ticket-' + ticketId)
            .setPlaceholder('Elige una categoría')
            .addOptions(arrOptions);

        const row = new ActionRowBuilder()
            .addComponents(dropdown);

        await interaction.editReply({
            content: `Ticket #${ticketId} \n Ticket generado por: <@${dto.userId}> \n ${dto.message} \n Estado del ticket`,
            components: [row],
        });
    }

    async closeTicket(client, interaction) {
        const result = interaction.fields.getTextInputValue('result_message');
        const ticketId = parseInt(interaction.customId.split('-')[1]);

        // Antes esto era un deferReply({ content }), y deferReply ignora el content: la
        // interacción quedaba deferida sin respuesta, con el "pensando..." eterno.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const dto = (await ticket.GetById(ticketId))[0];

        if (!dto) {
            await interaction.editReply({ content: `El ticket #${ticketId} ya no existe.` });
            return;
        }

        await this.#checkStatus(ticketId);

        await status_ticket.Update({
            id: ticketId,
            status: "close",
        });

        await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, 'Cerrado', this.#nombre(interaction.user), interaction.guild.name, result);

        if (dto.messageId) {
            const message = await interaction.channel.messages.fetch(dto.messageId).catch(() => null);

            if (message) {
                await message.delete().catch(() => { });
            }
        }

        await interaction.editReply({ content: `¡Caso cerrado con exito!` });
    }
}

module.exports = {
    interactionLib,
}
