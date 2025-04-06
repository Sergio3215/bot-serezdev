const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { setTicket, Ticket, statusTicket } = require('../db');

const set_ticket = new setTicket();
const ticket = new Ticket();
const status_ticket = new statusTicket();

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

    async BtnTicket(interaction) {

        if (interaction.replied || interaction.deferred) {
            console.warn("❌ Esta interacción ya fue respondida. No se puede mostrar el modal.");
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

    async TicketForm(interaction) {

        const message = interaction.fields.getTextInputValue('report_message');

        const pendding_channel = (await set_ticket.GetById(interaction.guild.id))[0].pendingChannel;
        const channel = await interaction.guild.channels.fetch(pendding_channel);

        let options = {
            id: interaction.guild.id,
            userId: interaction.user.id,
            message: message,
        }

        const dto = await ticket.Create(options);
        let ticketId = dto.ticketId;

        let btn_ticket = new ButtonBuilder()
            .setCustomId('Tkt-' + ticketId)
            .setLabel('Abrir Ticket')
            .setStyle(ButtonStyle.Success);

        let row = new ActionRowBuilder()
            .addComponents(btn_ticket);

        const messageId = (await channel.send({
            content: `¿Deseas crear un ticket?`,
            components: [row]
        })).id;

        options = {
            id: ticketId,
            userId: interaction.user.id,
            message: message,
            messageId: messageId
        }


        await ticket.Update(options);

        try {

            await interaction.reply({
                content: `Se ha creado un ticket con el número ${ticketId}`,
                ephemeral: true
            });
        } catch (error) {
            console.log(error);
        }

        return `Se ha creado un ticket con el número ${ticketId}`;

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
            await status_ticket.Create(opt);
            open = true;
        }


        let arrOptions = [
            (open) ? { label: 'Abierto', value: 'open', default: true } : { label: 'Abierto', value: 'open' },
            (inProgress) ? { label: 'En Proceso', value: 'in progress', default: true } : { label: 'En Proceso', value: 'in progress' },
            (resolve) ? { label: 'Resuelto', value: 'resolve', default: true } : { label: 'Resuelto', value: 'resolve' },
            (close) ? { label: 'Cerrado', value: 'close', default: true } : { label: 'Cerrado', value: 'close' }
        ]

        return { arrOptions };
    }

    async #sendUserMessageTicket(client, userId, ticketId, message, status, remited, guild, result) {
        const user = await client.users.fetch(userId);
        user.send({
            content: `**Ticket #${ticketId}** \n El ticket con el siguiente mensaje:\n **${message}** ${(result == "") ? "" : `\n Resultado del Ticket:\n${result}`} \n Tiene un estado de **${status}** \n Estado del ticket remitido por **${remited}** en el servidor **${guild}**`,
            ephemeral: true
        });

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
        const ticketId = parseInt(interaction.customId.split('-')[1]);
        const dto = (await ticket.GetById(ticketId))[0];

        const { arrOptions } = await this.#checkStatus(ticketId);


        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('dropdown_ticket-' + ticketId)
            .setPlaceholder('Elige una categoría')
            .addOptions(arrOptions);

        const row = new ActionRowBuilder()
            .addComponents(dropdown);

        await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, "Abrierto", interaction.user.globalName, interaction.guild.name, "");

        interaction.update({
            content: `Ticket #${ticketId} \n Ticket generado por: <@${dto.userId}> \n ${dto.message} \n Estado del ticket`,
            components: [row],
        });
    }


    async setTicketStatus(client, interaction) {
        const ticketId = parseInt(interaction.customId.split('-')[1]);
        const dto = (await ticket.GetById(ticketId))[0];

        if (interaction.values[0] != 'close') {
            const options = {
                id: ticketId,
                status: interaction.values[0],
            }

            const save_status = await status_ticket.Update(options);

            const { arrOptions } = await this.#checkStatus(ticketId, save_status);

            const { label } = await this.#labelStatus(interaction.values[0]);

            await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, label, interaction.user.globalName, interaction.guild.name, "");


            const dropdown = new StringSelectMenuBuilder()
                .setCustomId('dropdown_ticket-' + ticketId)
                .setPlaceholder('Elige una categoría')
                .addOptions(arrOptions);

            const row = new ActionRowBuilder()
                .addComponents(dropdown);

            interaction.update({
                content: `Ticket #${ticketId} \n Ticket generado por: <@${dto.userId}> \n ${dto.message} \n Estado del ticket`,
                components: [row],
            });
        }
        else {

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

            interaction.showModal(modal)
        }

    }

    async closeTicket(client, interaction) {
        try {
            const result = interaction.fields.getTextInputValue('result_message');
            const ticketId = parseInt(interaction.customId.split('-')[1]);
            const dto = (await ticket.GetById(ticketId))[0];

            await this.#sendUserMessageTicket(client, dto.userId, ticketId, dto.message, 'Cerrado', interaction.user.globalName, interaction.guild.name, result);

            const options = {
                id: ticketId,
                status: "close",
            }

            const save_status = await status_ticket.Update(options);

            await interaction.deferReply({ content: `¡Caso cerrado con exito!`, ephemeral: true });

            const message = await interaction.channel.messages.fetch(dto.messageId);

            await message.delete();

            // Opcional: puedes eliminar la respuesta silenciosa luego
            setTimeout(() => {
                interaction.deleteReply().catch(() => { });
            }, 800);

        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = {
    interactionLib,
}