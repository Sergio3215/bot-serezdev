const { Server, SettingWelcome, MetricCommands, ContadorCommand } = require("../db/index.js");
const { Library } = require("../library/index.js");
const LibsCommands = require("./lib.js");
const { Rules } = require("./rules.js");
const { Battle } = require("./social/Battle/index.js");
const { Romance } = require("./social/Romance/index.js");
const { Saludos } = require("./social/Saludos/index.js");
const { Terror } = require("./social/Terror/index.js");
const { Twitch } = require("./social/Twitch/index.js");
const { Social } = require("./social/index.js");

const contador_command = new ContadorCommand();

const ServerDb = new Server();
let libCommands = new LibsCommands();
const metrica_commands = new MetricCommands();
const library = new Library();

const battle = new Battle();
const romance = new Romance();
const saludos = new Saludos();
const terror = new Terror();
const twitch = new Twitch();
const social = new Social();

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

    //375805687529209857 Streamcord
    //276060004262477825 Koya
    //678344927997853742 Sapphire

    if (msg.author.id == "375805687529209857" || msg.author.id == "276060004262477825" || msg.author.id == "678344927997853742") {
        return;
    }


    const ruleContador = await contador_command.GetById(msg.guild.id);
    //Set Rules

    Rules(msg);

    if (ruleContador.length !== 0) {
        if (ruleContador[0].channelId === msg.channel.id) return;
    }


    //Project bot smart
    if (msg.content.includes('<@')) {
        const botId = msg.content.split('<@')[1].split('>')[0];


        if (botId == client.user.id) {
            libCommands.BotChat(client, msg);
        }
    }


    if (msg.channel.name.includes('anuncio') || msg.channel.name.includes('stream') || msg.channel.name.includes('twitch') || msg.channel.name.includes('tiktok') || msg.channel.name.includes('kick')) {
        return;
    }

    // Set Commands

    const close = await libCommands.comprobateChannel(msg);

    if (close && msg.author.id !== client.user.id && msg.content !== "!abrir") {
        msg.delete();
        library.SendMessageTemp(msg.channel, 'Este canal está cerrado.', 5000);
        return;
    }

    if (msg.content.includes('!comandos')) {
        libCommands.Comandos(isMod, admin, msg);
        setMetric("!comandos", msg);
    }

    if (msg.content.includes('!consulta')) {
        libCommands.ConsultingGemini(msg, Consulting, userIsSubOrBooster);
        setMetric("!consulta", msg);
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
        twitch.MeMide(msg);
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

    // TWITCH commands START
    if (msg.content.includes('!gay')) {
        twitch.Gay(msg, userIsSubOrBooster);
        setMetric("!gay", msg);
    }
    if (msg.content.includes('!gaga')) {
        twitch.Gaga(msg, userIsSubOrBooster);
        setMetric("!gaga", msg);
    }
    if (msg.content.includes('!meme')) {
        libCommands.Meme(msg, userIsSubOrBooster);
        setMetric("!meme", msg);
    }
    // TWITCH commands END

    //NEKOITINA Family Friendly START
    if (msg.content.toLowerCase().includes("!golpear")) {
        battle.Golpear(client, msg);
        setMetric("!golpear", msg);
    }

    if (msg.content.toLowerCase().includes("!sonrojar")) {
        romance.Sonrojar(client, msg);
        setMetric("!sonrojar", msg);
    }

    if (msg.content.toLowerCase().includes("!perseguir")) {
        terror.Perseguir(client, msg);
        setMetric("!perseguir", msg);
    }

    if (msg.content.toLowerCase().includes("!besar")) {
        romance.Besar(client, msg);
        setMetric("!besar", msg);
    }

    if (msg.content.toLowerCase().includes("!abrazar")) {
        romance.Abrazar(client, msg);
        setMetric("!abrazar", msg);
    }

    if (msg.content.toLowerCase().includes("!miedo")) {
        terror.Miedo(client, msg);
        setMetric("!miedo", msg);
    }

    if (msg.content.toLowerCase().includes("!intimidar")) {
        terror.Asustar(client, msg);
        setMetric("!intimidar", msg);
    }

    if (msg.content.toLowerCase().includes("!nalguear")) {
        romance.Nalguear(client, msg);
        setMetric("!nalguear", msg);
    }

    if (msg.content.toLowerCase().includes("!pensar")) {
        social.Pensar(client, msg);
        setMetric("!pensar", msg);
    }

    if (msg.content.toLowerCase().includes("!llorar")) {
        terror.Llorar(client, msg);
        setMetric("!llorar", msg);
    }

    if (msg.content.toLowerCase().includes("!hi")) {
        saludos.Saludar(client, msg);
        setMetric("!hi", msg);
    }

    if (msg.content.toLowerCase().includes("!bye")) {
        saludos.Despedirse(client, msg);
        setMetric("!bye", msg);
    }

    if (msg.content.toLowerCase().includes("!fc")) {
        social.FelizCumple(client, msg);
        setMetric("!fc", msg);
    }

    if (msg.content.toLowerCase().includes("!choquelos5")) {
        social.Choca5(client, msg);
        setMetric("!choquelos5", msg);
    }

    if (msg.content.toLowerCase().includes("!enojarse")) {
        battle.Enojar(client, msg);
        setMetric("!enojarse", msg);
    }

    if (msg.content.toLowerCase().includes("!duelo")) {
        battle.Duelo(client, msg);
        setMetric("!duelo", msg);
    }
    //NEKOITINA Family Friendly END

    if (msg.content.toLowerCase().includes("!pareja")) {
        romance.Pareja(client, msg);
        setMetric("!pareja", msg);
    }

    if (msg.content.toLowerCase().includes("!cerrar")) {
        if (admin) {
            libCommands.Close(client, msg);
            setMetric("!cerrar", msg);
        }
        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }

    if (msg.content.toLowerCase().includes("!abrir")) {

        if (admin) {
            libCommands.Open(client, msg);
            setMetric("!abrir", msg);
        }
        else {
            msg.reply('No tienes permisos para usar este comando.');
        }
    }


    //test 
    if (msg.content.toLowerCase().includes("!test")) {
        libCommands.Test(client, msg);
    }
}


module.exports = {
    checkServer,
    commands,
    setMetric
};