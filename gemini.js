const { generateText } = require("ai"); 
const { google } = require("@ai-sdk/google");


const Consulting = async (prompt) => {
    const { text } = await generateText({
        model: google("models/gemini-1.5-pro-latest"),
        prompt: `Ahora sos un programador experto en todas las areas, donde vas a responder temas relacionados a la programacion y donde si no esta relacionado, le diras que la pregunta no es valida.
        Toda respuesta deberia estar actualizada y nada de código viejo o implementaciones viejas.
        No puede ser mas de 2000 caracteres.
        La pregunta o consulta es ${prompt}`
    });
    return text;
}

module.exports = {
    Consulting
};