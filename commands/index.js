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

    
    if (msg.content.includes('!setrules')) {

        if (admin || isMod) {
            libCommands.AceptRules(client, msg);
        }

        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }

    
    if (msg.content.includes('!settickets')) {

        if (admin || isMod) {
            libCommands.TicketButtton(client, msg);
        }

        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }

    //NEKOITINA Family Friendly
    if (msg.content.toLowerCase().includes("!golpear")) {
        libCommands.Golpear(client, msg);
    }

    if (msg.content.toLowerCase().includes("!sonrojar")) {
        libCommands.Sonrojar(client, msg);
    }

    if (msg.content.toLowerCase().includes("!perseguir")) {
        libCommands.Perseguir(client, msg);
    }

    if (msg.content.toLowerCase().includes("!besar")) {
        libCommands.Besar(client, msg);
    }

    if (msg.content.toLowerCase().includes("!abrazar")) {
        libCommands.Abrazar(client, msg);
    }

    if (msg.content.toLowerCase().includes("!pareja")) {
        libCommands.Pareja(client, msg);
    }
}


module.exports = {
    checkServer,
    commands,
};