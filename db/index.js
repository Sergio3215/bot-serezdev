const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_GIF_URL_PREFIX = "https://raw.githubusercontent.com/Sergio3215";

const getGifType = (url) => url.startsWith(DEFAULT_GIF_URL_PREFIX)
    ? "default"
    : "custom";

class Server {
    constructor() {

    }

    async Create(guild) {
        return await prisma.Server.create({
            data: {
                serverId: guild.id,
                serverName: guild.name,
            }

        });
    }

    async GetById(id) {
        try {
            return await prisma.Server.findMany({
                where: {
                    serverId: id
                }
            });
        } catch (error) {
            console.log(error.message);

        }
    }

    async Update(options) {
        await prisma.Server.update({
            where: {
                serverId: options.id
            },
            data: {
                buttonFollowingId: options.buttonFollowingId,
            }
        });
    }
}


class buttonFollowing {
    constructor() {

    }

    async Create(options) {
        return await prisma.buttonFollowing.create({
            data: {
                serverId: options.id,
                setChannel: options.channel,
                setRole: options.role,
            }

        });
    }

    // async Get() {
    //     return await prisma.profile.findMany();
    // }

    async GetById(id) {
        return await prisma.buttonFollowing.findMany({
            where: {
                serverId: id
            }
        });
    }

    async Update(options) {
        await prisma.buttonFollowing.update({
            where: {
                serverId: options.id
            },
            data: {
                setChannel: options.channel,
                setRole: options.role,
            }
        });
    }
}

class aceptRules {
    constructor() {

    }

    async Create(options) {
        return await prisma.aceptRules.create({
            data: {
                serverId: options.id,
                setChannel: options.channel,
                setRole: options.role,
                removeRole: options.removeRole,
            }

        });
    }

    // async Get() {
    //     return await prisma.profile.findMany();
    // }

    async GetById(id) {
        return await prisma.aceptRules.findMany({
            where: {
                serverId: id
            }
        });
    }

    async Update(options) {
        await prisma.aceptRules.update({
            where: {
                serverId: options.id
            },
            data: {
                setChannel: options.channel,
                setRole: options.role,
                removeRole: options.removeRole,
            }
        });
    }
}



class SettingWelcome {
    constructor() {

    }

    async Create(serverId, roleId) {
        return await prisma.settingWelcome.create({
            data: {
                serverId: serverId,
                setRole: roleId,
            }

        });
    }

    // async Get() {
    //     return await prisma.profile.findMany();
    // }

    async GetById(serverId) {
        return await prisma.settingWelcome.findMany({
            where: {
                serverId: serverId
            }
        });
    }

    async Update(options) {
        // console.log(options);
        await prisma.settingWelcome.update({
            where: {
                id: options.id
            },
            data: {
                setRole: options.role,
            }
        });
    }
}



class setTicket {
    constructor() {

    }

    async Create(options) {
        return await prisma.setTicket.create({
            data: {
                serverId: options.id,
                requestChannel: options.requestChannel,
                pendingChannel: options.pendingChannel,
            }

        });
    }

    // async Get() {
    //     return await prisma.profile.findMany();
    // }

    async GetById(id) {
        return await prisma.setTicket.findMany({
            where: {
                serverId: id
            }
        });
    }

    async Update(options) {
        await prisma.setTicket.update({
            where: {
                serverId: options.id
            },
            data: {
                requestChannel: options.requestChannel,
                pendingChannel: options.pendingChannel,
            }
        });
    }
}


class statusTicket {
    constructor() {

    }

    async Create(options) {
        return await prisma.statusTicket.create({
            data: {
                ticketId: options.id,
                status: options.status,
            }

        });
    }

    // async Get() {
    //     return await prisma.profile.findMany();
    // }

    async GetById(id) {
        return await prisma.statusTicket.findMany({
            where: {
                ticketId: id,
            }
        });
    }

    async Update(options) {
        await prisma.statusTicket.update({
            where: {
                ticketId: options.id,
            },
            data: {
                status: options.status,
            }
        });
    }
}


class Ticket {
    constructor() {

    }

    async #UpdateCounterTicket(id, ticketId) {
        await prisma.counter_ticket.update({
            where: {
                id: id,
            },
            data: {
                value: ticketId,
            }
        });
    }

    async #CreateCounterTicket(ticketId) {
        return await prisma.counter_ticket.create({
            data: {
                value: ticketId,
            }
        });
    }

    async Create(options) {
        const dto = await prisma.counter_ticket.findMany();

        let ticketId = 1;

        if (dto.length == 0) {
            await this.#CreateCounterTicket(ticketId);
        }
        else {
            ticketId = dto[0].value + 1;
            await this.#UpdateCounterTicket(dto[0].id, ticketId);
        }

        return await prisma.Tickets.create({
            data: {
                serverId: options.id,
                userId: options.userId,
                ticketId: ticketId,
                message: options.message,
            }

        });
    }

    // async Get() {
    //     return await prisma.Tickets.findMany();
    // }

    async GetById(id) {
        return await prisma.Tickets.findMany({
            where: {
                ticketId: id,
            }
        });
    }

    async Update(options) {
        await prisma.Tickets.update({
            where: {
                ticketId: options.id,
            },
            data: {
                messageId: options.messageId,
            }
        });
    }
}

class MetricCommands {
    constructor() {

    }

    async Create(option) {
        await prisma.metricCommands.create({
            data: {
                serverId: option.serverId,
                serverName: option.Name,
                numberUsed: 1,
                commandUsed: option.command
            }

        });
    }

    async Update(id, option) {
        await prisma.metricCommands.update({
            where: {
                id: id
            },
            data: {
                serverId: option.serverId,
                serverName: option.Name,
                numberUsed: option.number,
                commandUsed: option.command
            }
        });
    }

    async GetById(serverId, command) {
        return await prisma.metricCommands.findMany({
            where: {
                serverId: serverId,
                commandUsed: command
            }
        });
    }
}

class ContadorCommand {
    constructor() {

    }

    async Create(option) {
        await prisma.ContadorCommand.create({
            data: {
                serverId: option.serverId,
                serverName: option.serverName,
                modifiedBy: option.modifiedBy,
                channelId: option.channelId,
            }

        });
    }

    async Update(serverId, option) {
        await prisma.ContadorCommand.update({
            where: {
                serverId: serverId,
            },
            data: {
                count: option.count,
                channelId: option.channelId,
                modifiedBy: option.modifiedBy,
                modifiedOn: new Date(),
            }
        });
    }

    async GetById(serverId) {
        return await prisma.ContadorCommand.findMany({
            where: {
                serverId: serverId,
            }
        });
    }

    async Get() {
        return await prisma.ContadorCommand.findMany();
    }
}

class BirthdaySetup {
    constructor() {

    }

    async Create(option) {
        await prisma.BirthdaySetUp.create({
            data: {
                serverId: option.serverId,
                serverName: option.serverName,
                channelId: option.channelId,
                message: option.message
            }

        });
    }

    async Update(serverId, option) {
        await prisma.BirthdaySetUp.update({
            where: {
                serverId: serverId,
            },
            data: {
                channelId: option.channelId,
                message: option.message
            }
        });
    }

    async GetById(serverId) {
        return await prisma.BirthdaySetUp.findMany({
            where: {
                serverId: serverId,
            }
        });
    }

    async Get() {
        return await prisma.BirthdaySetUp.findMany();
    }
}

class Birthday {
    constructor() {

    }

    async Create(option) {
        await prisma.Birthday.create({
            data: {
                serverId: option.serverId,
                serverName: option.serverName,
                userId: option.userId,
                age: option.age == "" ? 0 : parseInt(option.age),
                day: option.day,
                month: option.month,
            }

        });
    }

    async Update(id, option) {
        await prisma.Birthday.update({
            where: {
                id: id,
            },
            data: {
                age: option.age == "" ? 0 : parseInt(option.age),
                day: option.day,
                month: option.month,
            }
        });
    }

    async GetById(serverId) {
        return await prisma.Birthday.findMany({
            where: {
                serverId: serverId,
            }
        });
    }
}

class LoggChatBot {
    constructor() {

    }

    async Create(option) {
        await prisma.LoggChatBot.create({
            data: {
                serverId: option.serverId,
                userId: option.userId,
                userName: option.userName,
                message: option.message,
                afinity: option.afinity,
            }

        });
    }

    async GetById(userId) {
        return await prisma.LoggChatBot.findMany({
            where: {
                userId: userId,
            }
        });
    }
}

class CloseChannel {

    constructor() { }

    async Create(option) {
        await prisma.closeChannel.create({
            data: {
                channelId: option.channelId,
                channelName: option.channelName,
                serverId: option.serverId,
                serverName: option.serverName,
                close: option.close
            }

        });
    }


    async Update(id, option) {
        await prisma.closeChannel.update({
            where: {
                id: id,
            },
            data: {
                close: option.close
            }
        });
    }

    async GetById(id) {
        return await prisma.closeChannel.findMany({
            where: {
                channelId: id
            }
        })
    }

}

class Gifs {
    constructor() { }

    async getGifsByInteraction(serverId, id) {
        return await prisma.gif.findMany({
            where: {
                serverId: serverId,
                interaction: {
                    id: id
                }
            },
            orderBy: {
                order: "desc"
            }
        });
    }

    async getGifsByInteractionByName(serverId, name) {
        return await prisma.gif.findMany({
            where: {
                serverId: serverId,
                interaction: {
                    name: name
                }
            },
            orderBy: {
                order: "desc"
            }
        });
    }

    async createGiftByInteractionId(order, serverId, url, interactionId) {
        await prisma.gif.create({
            data: {
                order: order,
                serverId: serverId,
                url: url,
                type: getGifType(url),
                interactionId: interactionId
            }
        });
    }


    async createGifByName(order, serverId, url, name) {
        let inte = await prisma.interactions.findMany();
        let interaction = inte.filter(i => i.name == name);

        await prisma.gif.create({
            data: {
                order: order,
                serverId: serverId,
                url: url,
                type: getGifType(url),
                interactionId: interaction[0].id
            }
        });
    }

    async updateGift(id, newUrl) {
        await prisma.gif.update({
            where: {
                id: id
            },
            data: {
                url: newUrl
            }
        });
    }

    /**
     * Reclasifica todos los gifs segun el origen de su URL.
     *
     * @returns {Promise<{default: Number, custom: Number}>}
     */
    async updateGifTypes() {
        const defaultResult = await prisma.gif.updateMany({
            where: {
                url: {
                    startsWith: DEFAULT_GIF_URL_PREFIX
                }
            },
            data: {
                type: "default"
            }
        });

        const customResult = await prisma.gif.updateMany({
            where: {
                NOT: {
                    url: {
                        startsWith: DEFAULT_GIF_URL_PREFIX
                    }
                }
            },
            data: {
                type: "custom"
            }
        });

        return {
            default: defaultResult.count,
            custom: customResult.count
        };
    }

    async deleteGift(id) {
        await prisma.gif.delete({
            where: {
                id: id
            }
        });
    }

    /**
     * Borra todos los gifs de un servidor, de todas las interacciones.
     * No toca las interacciones en sí, que son globales y las comparten
     * todos los servidores.
     *
     * @param {String} serverId
     * @returns {Promise<Number>} cuántos se borraron
     */
    async deleteByServer(serverId) {
        const { count } = await prisma.gif.deleteMany({
            where: {
                serverId: serverId
            }
        });

        return count;
    }
}

class Interaction {
    constructor() { }

    /**
     * 
     * @param {Array<Object>} gifts 
     * @param {String} name
     * 
     */
    async createInteractionAndGifs(gifts, name) {
        await prisma.interactions.create({
            data: {
                name: name,

                gifs: {
                    create: gifts
                }
            },

            include: {
                gifs: true
            }
        });
    }

    async getInteractionByNameAndServer(name, serverId) {
        return await prisma.interactions.findMany({
            where: {
                name: name
            },
            include: {
                gifs: {
                    where: {
                        serverId: serverId
                    },
                    orderBy: {
                        order: "asc"
                    }
                }
            }
        });
    }


    async getInteractions() {
        return await prisma.interactions.findMany();
    }

    async deleteIntegraction(id) {
        return await prisma.interactions.delete({
            where: {
                id: id
            }
        })
    }

}

class WelcomeCard {
    constructor() {

    }

    /**
     * Mismo shape que el resto de las clases (array), para que la API pueda
     * responder { data: [...] } y el panel lea data[0].
     */
    async GetById(serverId) {
        return await prisma.welcomeCard.findMany({
            where: {
                serverId: serverId,
            }
        });
    }

    /**
     * Para el guildMemberAdd: una sola lectura por el índice de serverId.
     * Devuelve el documento o null.
     */
    async GetOne(serverId) {
        return await prisma.welcomeCard.findUnique({
            where: {
                serverId: serverId,
            }
        });
    }

    async Create(option) {
        return await prisma.welcomeCard.create({
            data: {
                serverId: option.serverId,
                enabled: option.enabled,
                channelId: option.channelId,
                messageContent: option.messageContent,
                config: option.config,
            }

        });
    }

    async Update(serverId, option) {
        await prisma.welcomeCard.update({
            where: {
                serverId: serverId,
            },
            data: {
                enabled: option.enabled,
                channelId: option.channelId,
                messageContent: option.messageContent,
                config: option.config,
            }
        });
    }

    /**
     * El panel manda POST la primera vez y PUT después, pero como serverId es
     * unique los dos se resuelven acá sin averiguar antes si la fila existe.
     */
    async Upsert(serverId, option) {
        const data = {
            enabled: option.enabled,
            channelId: option.channelId,
            messageContent: option.messageContent,
            config: option.config,
        };

        return await prisma.welcomeCard.upsert({
            where: {
                serverId: serverId,
            },
            create: {
                serverId: serverId,
                ...data
            },
            update: data
        });
    }
}

/**
 * El diseño de la imagen de cumpleaños.
 *
 * No guarda canal ni mensaje: esos ya están en birthday_setup. Acá vive solo la
 * receta que dibuja el cron, y la imagen sale adjunta a ese mismo saludo.
 */
class BirthdayCard {
    constructor() {

    }

    /**
     * Mismo shape que el resto de las clases (array), para que la API pueda
     * responder { data: [...] } y el panel lea data[0].
     */
    async GetById(serverId) {
        return await prisma.birthdayCard.findMany({
            where: {
                serverId: serverId,
            }
        });
    }

    /**
     * Para el cron de cumpleaños: una sola lectura por el índice de serverId.
     * Devuelve el documento o null.
     */
    async GetOne(serverId) {
        return await prisma.birthdayCard.findUnique({
            where: {
                serverId: serverId,
            }
        });
    }

    async Create(option) {
        return await prisma.birthdayCard.create({
            data: {
                serverId: option.serverId,
                enabled: option.enabled,
                config: option.config,
            }

        });
    }

    async Update(serverId, option) {
        await prisma.birthdayCard.update({
            where: {
                serverId: serverId,
            },
            data: {
                enabled: option.enabled,
                config: option.config,
            }
        });
    }

    /**
     * El panel manda POST la primera vez y PUT después, pero como serverId es
     * unique los dos se resuelven acá sin averiguar antes si la fila existe.
     */
    async Upsert(serverId, option) {
        const data = {
            enabled: option.enabled,
            config: option.config,
        };

        return await prisma.birthdayCard.upsert({
            where: {
                serverId: serverId,
            },
            create: {
                serverId: serverId,
                ...data
            },
            update: data
        });
    }
}

module.exports = {
    Server,
    buttonFollowing,
    SettingWelcome,
    WelcomeCard,
    aceptRules,
    setTicket,
    statusTicket,
    Ticket,
    MetricCommands,
    ContadorCommand,
    BirthdaySetup,
    BirthdayCard,
    Birthday,
    LoggChatBot,
    CloseChannel,
    Gifs,
    Interaction
};
