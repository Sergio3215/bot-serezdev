const { prisma } = require("../../db/index.js");
const { AddCleanupInterval } = require("../messageCleanup/time.js");

class AutoCleanMessageRepository {
    constructor({ client = prisma, now = () => new Date() } = {}) {
        this.client = client;
        this.now = now;
    }

    async Create(option) {
        const createdAt = this.now();
        return await this.client.autoCleanMessage.create({
            data: {
                serverId: option.serverId,
                channelId: option.channelId,
                frequencyValue: option.frequencyValue,
                frequencyUnit: option.frequencyUnit,
                enabled: option.enabled ?? true,
                nextRunAt: AddCleanupInterval(
                    createdAt,
                    option.frequencyValue,
                    option.frequencyUnit,
                ),
            },
        });
    }

    async GetById(id) {
        return await this.client.autoCleanMessage.findUnique({ where: { id } });
    }

    async GetByServerId(serverId) {
        return await this.client.autoCleanMessage.findMany({
            where: { serverId },
            orderBy: { createdAt: "asc" },
        });
    }

    async GetEnabled() {
        return await this.client.autoCleanMessage.findMany({
            where: { enabled: true },
            orderBy: { nextRunAt: "asc" },
        });
    }

    async ExistsForChannel(serverId, channelId) {
        const record = await this.client.autoCleanMessage.findUnique({
            where: { serverId_channelId: { serverId, channelId } },
            select: { id: true },
        });
        return record !== null;
    }

    async GetChangeSignature() {
        const signature = await this.client.autoCleanMessage.aggregate({
            _count: { _all: true },
            _max: { updatedAt: true },
        });
        return {
            count: signature._count._all,
            lastUpdatedAt: signature._max.updatedAt?.toISOString() ?? null,
        };
    }

    async Update(id, option) {
        const current = await this.GetById(id);
        if (!current) {
            const error = new Error("Auto Clean Message inexistente");
            error.code = "P2025";
            throw error;
        }

        const intervalChanged = current.frequencyValue !== option.frequencyValue
            || current.frequencyUnit !== option.frequencyUnit;
        const reactivated = current.enabled === false && option.enabled === true;
        const data = {
            serverId: option.serverId,
            channelId: option.channelId,
            frequencyValue: option.frequencyValue,
            frequencyUnit: option.frequencyUnit,
            ...(option.enabled === undefined ? {} : { enabled: option.enabled }),
        };
        if (intervalChanged || reactivated) {
            data.nextRunAt = AddCleanupInterval(
                this.now(),
                option.frequencyValue,
                option.frequencyUnit,
            );
        }

        return await this.client.autoCleanMessage.update({ where: { id }, data });
    }

    async UpdateStatus(id, enabled) {
        const current = await this.GetById(id);
        if (!current) {
            const error = new Error("Auto Clean Message inexistente");
            error.code = "P2025";
            throw error;
        }

        const data = { enabled };
        if (enabled && !current.enabled) {
            data.nextRunAt = AddCleanupInterval(
                this.now(),
                current.frequencyValue,
                current.frequencyUnit,
            );
        }
        return await this.client.autoCleanMessage.update({ where: { id }, data });
    }

    async RecordSuccess(id, expectedNextRunAt, completedAt, nextRunAt) {
        const result = await this.client.autoCleanMessage.updateMany({
            where: {
                id,
                enabled: true,
                nextRunAt: expectedNextRunAt,
            },
            data: {
                lastRunAt: completedAt,
                nextRunAt,
            },
        });
        return result.count > 0;
    }

    async RecordRetry(id, expectedNextRunAt, retryAt) {
        const result = await this.client.autoCleanMessage.updateMany({
            where: {
                id,
                enabled: true,
                nextRunAt: expectedNextRunAt,
            },
            data: { nextRunAt: retryAt },
        });
        return result.count > 0;
    }

    async Delete(id) {
        return await this.client.autoCleanMessage.delete({ where: { id } });
    }
}

module.exports = { AutoCleanMessageRepository };
