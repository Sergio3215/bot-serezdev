const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
                numberUsed: 1,
                commandUsed: option.command
            }

        });
    }

    async Update(serverId, option) {
        await prisma.metricCommands.update({
            where: {
                serverId: serverId
            },
            data: {
                serverId: serverId,
                numberUsed: option.number,
                commandUsed: option.command
            }
        });
    }

    async GetById(serverId) {
        return await prisma.metricCommands.findMany({
            where: {
                serverId: serverId
            }
        });
    }
}

module.exports = {
    Server,
    buttonFollowing,
    SettingWelcome,
    aceptRules,
    setTicket,
    statusTicket,
    Ticket,
    MetricCommands
};