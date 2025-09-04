const { Server, SettingWelcome, MetricCommands } = require("../db/index.js");
const LibsCommands = require("./lib.js");

const ServerDb = new Server();
let libCommands = new LibsCommands();
const metrica_commands = new MetricCommands();

const checkServer = async (guild) => {
    let dataServer = (await ServerDb.GetById(guild.id));
    if (dataServer.length == 0) {
        dataServer = await ServerDb.Create(guild);
    }
}

const setMetric = async (command, msg) => {
    if (process.env.DEV !== "TRUE") {
        const metricaCollection = await metrica_commands.GetById(msg.guild.id, command);
        if (metricaCollection.length === 0) {
            await metrica_commands.Create({
                serverId: msg.guild.id,
                Name: msg.guild.name,
                command: command
            });
        }
        else {
            await metrica_commands.Update(metricaCollection[0].id, {
                serverId: msg.guild.id,
                Name: msg.guild.name,
                number: metricaCollection[0].numberUsed + 1,
                command: command
            })
        }
    }
}

const commands = async (client, msg, Consulting, admin, isMod, userIsSubOrBooster, createCharacter) => {


    //Set Rules

    //💀 LA MORGUE 💀

    //console.log(msg.channel.id); id: '1413026508276236351', name: '😆video-reaccion-en-stream😆'
    //console.log(msg.guild); id: '748652112485023854', name: '💀 LA MORGUE 💀'

    if (msg.guild.id == "748652112485023854") {
        if (msg.channel.id == "1413026508276236351") {
            if (!msg.content.includes("https://www.youtube.com/") && !msg.content.includes("https://youtu.be")) {
                msg.delete();
            }
        }
    }

    // Set Commands

    if (msg.content.includes('!comandos')) {
        libCommands.Comandos(isMod, admin, msg);
        setMetric("!comandos", msg);
    }

    if (msg.content.includes('!consulta')) {
        libCommands.ConsultingGemini(msg, Consulting, userIsSubOrBooster);
        setMetric("!consulta", msg);
    }
    if (msg.content.includes('!gay')) {
        libCommands.Gay(msg, userIsSubOrBooster);
        setMetric("!gay", msg);
    }
    if (msg.content.includes('!gaga')) {
        libCommands.Gaga(msg, userIsSubOrBooster);
        setMetric("!gaga", msg);
    }

    if (msg.content.toLowerCase().includes("!rolplay")) {
        libCommands.Personaje(msg, createCharacter, userIsSubOrBooster);
        setMetric("!rolplay", msg);
    }

    if (msg.content.toLowerCase().includes("!rolnivel")) {
        libCommands.Nivel(msg, userIsSubOrBooster);
        setMetric("!rolnivel", msg);
    }

    if (msg.content.includes('!memide')) {
        libCommands.MeMide(msg);
        setMetric("!memide", msg);
    }

    if (msg.content.includes('!setwelcome')) {
        setMetric("!setwelcome", msg);

        if (admin || isMod) {
            libCommands.setWelcome(msg);
        }
        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }

    if (msg.content.includes('!setfollowing')) {
        setMetric("!setfollowing", msg);

        if (admin || isMod) {
            libCommands.SettingsButton(client, msg);
        }

        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }


    if (msg.content.includes('!setrules')) {
        setMetric("!setrules", msg);

        if (admin || isMod) {
            libCommands.AceptRules(client, msg);
        }

        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }


    if (msg.content.includes('!settickets')) {
        setMetric("!settickets", msg);

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
        setMetric("!golpear", msg);
    }

    if (msg.content.toLowerCase().includes("!sonrojar")) {
        libCommands.Sonrojar(client, msg);
        setMetric("!sonrojar", msg);
    }

    if (msg.content.toLowerCase().includes("!perseguir")) {
        libCommands.Perseguir(client, msg);
        setMetric("!perseguir", msg);
    }

    if (msg.content.toLowerCase().includes("!besar")) {
        libCommands.Besar(client, msg);
        setMetric("!besar", msg);
    }

    if (msg.content.toLowerCase().includes("!abrazar")) {
        libCommands.Abrazar(client, msg);
        setMetric("!abrazar", msg);
    }

    if (msg.content.toLowerCase().includes("!miedo")) {
        libCommands.Miedo(client, msg);
        setMetric("!miedo", msg);
    }

    if (msg.content.toLowerCase().includes("!intimidar")) {
        libCommands.Asustar(client, msg);
        setMetric("!intimidar", msg);
    }

    if (msg.content.toLowerCase().includes("!nalguear")) {
        libCommands.Nalguear(client, msg);
        setMetric("!nalguear", msg);
    }

    if (msg.content.toLowerCase().includes("!pensar")) {
        libCommands.Pensar(client, msg);
        setMetric("!pensar", msg);
    }

    if (msg.content.toLowerCase().includes("!llorar")) {
        libCommands.Llorar(client, msg);
        setMetric("!llorar", msg);
    }

    if (msg.content.toLowerCase().includes("!hi")) {
        libCommands.Saludar(client, msg);
        setMetric("!hi", msg);
    }
    if (msg.content.toLowerCase().includes("!bye")) {
        libCommands.Despedirse(client, msg);
        setMetric("!bye", msg);
    }
    if (msg.content.toLowerCase().includes("!fc")) {
        libCommands.FelizCumple(client, msg);
        setMetric("!fc", msg);
    }
    if (msg.content.toLowerCase().includes("!choquelos5")) {
        libCommands.Choca5(client, msg);
        setMetric("!choquelos5", msg);
    }
    if (msg.content.toLowerCase().includes("!enojarse")) {
        libCommands.Enojar(client, msg);
        setMetric("!enojarse", msg);
    }


    if (msg.content.toLowerCase().includes("!duelo")) {
        libCommands.Duelo(client, msg);
        setMetric("!duelo", msg);
    }

    if (msg.content.toLowerCase().includes("!pareja")) {
        libCommands.Pareja(client, msg);
        setMetric("!pareja", msg);
    }
}


module.exports = {
    checkServer,
    commands,
};