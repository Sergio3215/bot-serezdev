const { Server, SettingWelcome } = require("../db/index.js");
const LibsCommands = require("./lib.js");

const ServerDb = new Server();
let libCommands = new LibsCommands();

const checkServer = async (guild) => {
    let dataServer = (await ServerDb.GetById(guild.id));
    if (dataServer.length == 0) {
        dataServer = await ServerDb.Create(guild);
    }
}

const commands = async (client, msg, Consulting, admin, isMod) => {

    // await checkServer(msg.guild);

    if (msg.content.includes('!consulta')) {
        libCommands.ConsultingGemini(msg, Consulting);
    }

    if (msg.content.includes('!memide')) {

        libCommands.MeMide(msg);
    }

    if (msg.content.includes('!setwelcome')) {

        if (admin || isMod) {
            libCommands.setWelcome(msg);
        }
        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }

    if (msg.content.includes('!setfollowing')) {

        if (admin || isMod) {
            libCommands.SettingsButton(client, msg);
        }

        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }
}


module.exports = {
    checkServer,
    commands,
};