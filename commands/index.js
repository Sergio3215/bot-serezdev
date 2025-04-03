import { Server, SettingWelcome } from "../db/index.js";
import LibsCommands from "./lib.js";

const ServerDb = new Server();
let libCommands = new LibsCommands();

export const checkServer = async (guild) => {
    let dataServer = (await ServerDb.GetById(guild.id));
    if (dataServer.length == 0) {
        dataServer = await ServerDb.Create(guild);
    }
    return dataServer;
}

export const commands = async (msg, Consulting, admin, isMod) => {
    
    await checkServer(msg.guild);

    if (msg.content.includes('!consulta')) {
        libCommands.ConsultingGemini(msg, Consulting);
    }

    if (msg.content.includes('!setwelcome')) {
        if(admin && isMod){
            libCommands.setWelcome(msg);
        }
        else{
            msg.reply('No tienes permisos para usar este comando.');
        }
       
        // libCommands.setWelcome(msg.guild.id, msg.content.split('!setwelcome')[1].trim());
    }
}