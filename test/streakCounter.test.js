const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const openaiScript = require("../openaiScript.js");

let generateImage;
mock.method(openaiScript, "generateImage", (...args) => generateImage(...args));
delete require.cache[require.resolve("../commands/lib.js")];
const LibsCommands = require("../commands/lib.js");

const CreateMessage = () => {
    const replies = [];
    const edits = [];

    return {
        id: "message-20",
        author: { id: "user-b" },
        replies,
        edits,
        async reply(payload) {
            replies.push(payload);
            return {
                async edit(updatedPayload) {
                    edits.push(updatedPayload);
                },
            };
        },
    };
};

test("la recompensa del 20 adjunta respuestas Base64 de GPT Image", async () => {
    const calls = [];
    generateImage = async (...args) => {
        calls.push(args);
        return {
            data: [{ b64_json: Buffer.from("fake-image").toString("base64") }],
        };
    };
    const msg = CreateMessage();

    await new LibsCommands().StreakCounter(msg, "¡Racha de 20 números Desbloqueado! 🎉");

    assert.equal(msg.replies.length, 1);
    assert.match(msg.replies[0].content, /Generando imagen/);
    assert.equal(calls[0][2], "gpt-image-2.5-flare");
    assert.equal(calls[0][3], "1536x1024");
    assert.equal(msg.edits.length, 1);
    assert.equal(msg.edits[0].files.length, 1);
    assert.equal(msg.edits[0].files[0].attachment.toString(), "fake-image");
    assert.equal(msg.edits[0].embeds[0].data.image.url, "attachment://recompensa-contador-message-20.png");
});

test("si falla la imagen mantiene visible el desbloqueo de la recompensa", async () => {
    generateImage = async () => {
        throw new Error("image API unavailable");
    };
    const msg = CreateMessage();
    const errorLog = mock.method(console, "error", () => {});

    try {
        await new LibsCommands().StreakCounter(msg, "¡Racha de 20 números Desbloqueado! 🎉");
    } finally {
        errorLog.mock.restore();
    }

    assert.equal(msg.replies.length, 1);
    assert.equal(msg.edits.length, 1);
    assert.match(msg.edits[0].content, /desbloqueado un wallpaper/);
    assert.match(msg.edits[0].content, /desbloqueo quedó registrado/);
});
