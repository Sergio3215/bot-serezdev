const { prisma } = require("../../db/index.js");

class GhostMessageRepository {
    constructor({ client = prisma } = {}) {
        this.client = client;
    }

    async Create(option) {
        return await this.client.ghostMessage.create({
            data: {
                serverId: option.serverId,
                channelId: option.channelId,
                lifetimeValue: option.lifetimeValue,
                lifetimeUnit: option.lifetimeUnit,
                enabled: option.enabled ?? true,
            },
        });
    }

    async GetById(id) {
        return await this.client.ghostMessage.findUnique({ where: { id } });
    }

    async GetByServerId(serverId) {
        return await this.client.ghostMessage.findMany({
            where: { serverId },
            orderBy: { createdAt: "asc" },
        });
    }

    async GetEnabled() {
        return await this.client.ghostMessage.findMany({
            where: { enabled: true },
            orderBy: { createdAt: "asc" },
        });
    }

    async ExistsForChannel(serverId, channelId) {
        const record = await this.client.ghostMessage.findUnique({
            where: { serverId_channelId: { serverId, channelId } },
            select: { id: true },
        });
        return record !== null;
    }

    async GetChangeSignature() {
        const signature = await this.client.ghostMessage.aggregate({
            _count: { _all: true },
            _max: { updatedAt: true },
        });
        return {
            count: signature._count._all,
            lastUpdatedAt: signature._max.updatedAt?.toISOString() ?? null,
        };
    }

    async Update(id, option) {
        return await this.client.ghostMessage.update({
            where: { id },
            data: {
                serverId: option.serverId,
                channelId: option.channelId,
                lifetimeValue: option.lifetimeValue,
                lifetimeUnit: option.lifetimeUnit,
                ...(option.enabled === undefined ? {} : { enabled: option.enabled }),
            },
        });
    }

    async UpdateStatus(id, enabled) {
        return await this.client.ghostMessage.update({
            where: { id },
            data: { enabled },
        });
    }

    async Delete(id) {
        return await this.client.ghostMessage.delete({ where: { id } });
    }
}

module.exports = { GhostMessageRepository };
