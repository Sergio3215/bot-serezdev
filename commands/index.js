import LibsCommands from "./lib.js";

export const commands = async (msg, Consulting)=>{
    if (msg.content.includes('!consulta')) {
        let libCommands = new LibsCommands();
        libCommands.ConsultingGemini(msg, Consulting);
    }
}