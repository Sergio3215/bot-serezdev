const { DEFAULT_IMAGE_MODEL } = require("../openaiScript.js");
const LibsCommands = require("../commands/lib.js");

const REWARD_SIZE = "1536x1024";

const readPngDimensions = (buffer) => {
    const pngSignature = "89504e470d0a1a0a";

    if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
        throw new Error("La recompensa no contiene un PNG válido");
    }

    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
    };
};

const run = async () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY no está configurada");
    }

    let initialReply;
    let finalReply;
    const fakeDiscordMessage = {
        id: "prueba-real-20",
        author: { id: "usuario-prueba" },
        async reply(payload) {
            initialReply = payload;
            return {
                async edit(updatedPayload) {
                    finalReply = updatedPayload;
                },
            };
        },
    };

    const startedAt = Date.now();
    await new LibsCommands().StreakCounter(
        fakeDiscordMessage,
        "¡Racha de 20 números Desbloqueado! 🎉",
    );

    if (!initialReply?.content?.includes("Generando imagen")) {
        throw new Error("No se publicó el aviso inicial de la recompensa");
    }

    if (finalReply?.files?.length !== 1 || finalReply?.embeds?.length !== 1) {
        throw new Error(`La ruta productiva no adjuntó la imagen: ${finalReply?.content || "sin detalle"}`);
    }

    const imageBuffer = finalReply.files[0].attachment;
    const dimensions = readPngDimensions(imageBuffer);

    if (`${dimensions.width}x${dimensions.height}` !== REWARD_SIZE) {
        throw new Error(
            `La imagen tiene dimensiones ${dimensions.width}x${dimensions.height}; se esperaba ${REWARD_SIZE}`,
        );
    }

    console.log(JSON.stringify({
        ok: true,
        route: "LibsCommands.StreakCounter",
        milestone: 20,
        model: process.env.OPENAI_REWARD_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
        dimensions: `${dimensions.width}x${dimensions.height}`,
        bytes: imageBuffer.length,
        attachmentUrl: finalReply.embeds[0].data.image.url,
        elapsedMs: Date.now() - startedAt,
    }));
};

run().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error.message,
        status: error.status,
        code: error.code,
    }));
    process.exitCode = 1;
});
