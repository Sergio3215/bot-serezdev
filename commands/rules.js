const { ContadorCommand } = require("../db");
const LibsCommands = require("./lib");

const BOT_USER_ID = "1312903712238469170";

/**
 * Crea el procesador del contador.
 *
 * Cada instancia mantiene una cola independiente por servidor/canal. La
 * función que se devuelve NO es async a propósito: registrar el trabajo en la
 * cola ocurre de forma síncrona apenas Discord emite messageCreate, antes de
 * que otro await pueda alterar el orden de llegada.
 */
const CreateRules = ({ contadorCommand, lib, logger = console }) => {
    const queues = new Map();

    const resetCounter = async (counter) => {
        await contadorCommand.Update(counter.serverId, {
            modifiedBy: "",
            count: 0,
        });
    };

    const processMessage = async (msg) => {
        let isCounterChannel = false;

        try {
            // 💀 LA MORGUE 💀
            if (msg.guild.id === "748652112485023854" && msg.channel.id === "1413026508276236351") {
                if (!msg.content.includes("https://www.youtube.com/") && !msg.content.includes("https://youtu.be")) {
                    await msg.delete();
                }
            }

            const counters = await contadorCommand.GetById(msg.guild.id);
            if (counters.length === 0 || counters[0].channelId !== msg.channel.id) {
                return false;
            }

            isCounterChannel = true;
            const counter = counters[0];

            // Los mensajes automáticos no participan del contador. Esto evita
            // que las respuestas del propio bot rompan la racha.
            if (msg.author.bot || msg.author.id === BOT_USER_ID) {
                return true;
            }

            const content = msg.content.trim();
            const isInteger = /^(0|[1-9]\d*)$/.test(content);
            const number = isInteger ? Number(content) : Number.NaN;

            if (!Number.isSafeInteger(number)) {
                await resetCounter(counter);
                await msg.delete();
                return true;
            }

            if (counter.modifiedBy === msg.author.id) {
                await resetCounter(counter);
                await msg.react("❌");
                await msg.channel.send("No puedes contar dos veces seguidas. Racha terminada.");
                return true;
            }

            if (number !== counter.count + 1) {
                await resetCounter(counter);
                await msg.react("❌");
                await msg.channel.send("No puedes repetir el mismo numero o saltarte alguno. Racha terminada.");
                return true;
            }

            await contadorCommand.Update(msg.guild.id, {
                modifiedBy: msg.author.id,
                count: number,
            });
            await msg.react("✅");

            if (number % 20 === 0) {
                const messageStreak = `¡Racha de ${number} números Desbloqueado! 🎉`;
                await lib.StreakCounter(msg, messageStreak);
            }

            return true;
        } catch (error) {
            logger.error("Error en la regla del contador de comandos:", error);
            return isCounterChannel;
        }
    };

    return (msg) => {
        if (!msg?.guild?.id || !msg?.channel?.id) {
            return Promise.resolve(false);
        }

        const key = `${msg.guild.id}:${msg.channel.id}`;
        const previous = queues.get(key) ?? Promise.resolve();
        const current = previous
            // Un fallo previo no puede dejar bloqueada para siempre la cola.
            .catch(() => undefined)
            .then(() => processMessage(msg));

        queues.set(key, current);

        // Sólo elimina la entrada si sigue siendo el último trabajo de la cola;
        // si ya llegó otro mensaje, ese nuevo trabajo conserva la referencia.
        void current.finally(() => {
            if (queues.get(key) === current) {
                queues.delete(key);
            }
        }).catch(() => undefined);

        return current;
    };
};

const contadorCommand = new ContadorCommand();
const lib = new LibsCommands();
const Rules = CreateRules({ contadorCommand, lib });

module.exports = {
    CreateRules,
    Rules,
};
