const test = require("node:test");
const assert = require("node:assert/strict");

const {
    DEFAULT_IMAGE_MODEL,
    getGeneratedImagePayload,
} = require("../openaiScript.js");

test("el modelo de imágenes por defecto ya no usa DALL-E 3", () => {
    assert.equal(DEFAULT_IMAGE_MODEL, "gpt-image-2.5-flare");
});

test("convierte una respuesta Base64 de GPT Image en un adjunto de Discord", () => {
    const payload = getGeneratedImagePayload({
        data: [{ b64_json: Buffer.from("fake-image").toString("base64") }],
    }, "imagen.png");

    assert.equal(payload.imageUrl, "attachment://imagen.png");
    assert.equal(payload.files.length, 1);
    assert.equal(payload.files[0].name, "imagen.png");
    assert.equal(payload.files[0].attachment.toString(), "fake-image");
});

test("mantiene compatibilidad con respuestas que todavía incluyen URL", () => {
    const payload = getGeneratedImagePayload({
        data: [{ url: "https://example.com/generated.png" }],
    }, "imagen.png");

    assert.equal(payload.imageUrl, "https://example.com/generated.png");
    assert.deepEqual(payload.files, []);
});
