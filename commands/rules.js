const { ContadorCommand } = require("../db");

const contador_command = new ContadorCommand();

const Rules = async (msg) => {

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

    // Rule para el contador de comandos
    const ruleContador = await contador_command.GetById(msg.guild.id);
    if (ruleContador.length !== 0) {
        if (ruleContador[0].channelId === msg.channel.id) {
            try {
                let number = parseInt(msg.content);
                if (isNaN(number) && msg.author.id !== '1312903712238469170') throw new Error("No es un numero");

                if (ruleContador[0].modifiedBy === msg.author.id && msg.author.id !== '1312903712238469170') {
                    const updateData = {
                        channelId: ruleContador[0].channelId,
                        modifiedBy: '',
                        count: 0,
                    };

                    await msg.react("❌");
                    await contador_command.Update(msg.guild.id, updateData);

                    await msg.channel.send("No puedes contar dos veces seguidas. Racha terminada.");
                }
                else if (msg.author.id !== '1312903712238469170') {
                    if (number !== ruleContador[0].count + 1) {
                        const updateData = {
                            channelId: ruleContador[0].channelId,
                            modifiedBy: '',
                            count: 0,
                        };

                        await msg.react("❌");
                        await contador_command.Update(msg.guild.id, updateData);

                        await msg.channel.send("No puedes repetir el mismo numero o saltarte alguno. Racha terminada.");
                    }
                    else {
                        await msg.react("✅");

                        const updateData = {
                            channelId: ruleContador[0].channelId,
                            modifiedBy: msg.author.id,
                            count: ruleContador[0].count + 1,
                        };
                        await contador_command.Update(msg.guild.id, updateData);
                    }
                }

            } catch (error) {
                console.log("Error en la regla del contador de comandos:", error.message);
                await msg.delete();
            }
        }
    }

}

module.exports = {
    Rules
};