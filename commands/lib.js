
export default class LibsCommands{

    constructor(){

    }

    async ConsultingGemini(msg, Consulting){
        try {
            if (msg.author.id !== "1312903712238469170") {
                if (msg.content.includes('!') && msg.channel.id == "1312924103971438654") {
                    let command = msg.content.split('!')[1];
                    if (command.toLowerCase().includes('consulta')) {
                        msg.channel.send("Pensando...");
                        let petitions = command.split('consulta')[1].trim();
                        let messageGemini = await Consulting(petitions);
                        msg.reply(messageGemini);
                    }
                }
                else {
                    if (msg.channel.id != "1235165837317505075") {
                        msg.delete();
                        msg.channel.send("Comando No Valido, o Canal Incorrecto");
                    }
                }
            }
        } catch (error) {
            console.log(error.message);
            msg.reply('No entendi tu pedido');
        }
    }

}