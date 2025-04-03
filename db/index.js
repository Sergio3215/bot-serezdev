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
        return await prisma.Server.findMany({
            where: {
                serverId: id
            }
        });
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

    async Create(guild) {
        return await prisma.buttonFollowing.create({
            data: {
                serverId: guild.id,
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
                mod: options.mod,
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

        console.log(options);
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

module.exports = {
    Server,
    buttonFollowing,
    SettingWelcome
};