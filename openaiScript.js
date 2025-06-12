const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ConsultingOpenAI = async (prompt) => {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
            role: "user", content: `
                    La siguiente consulta debe responderse en un máximo de 1900 caracteres.
                    - Sé directo, omite relleno.
                    - Resumi cualquier respuesta en algo concreto.
                    - Usa un lenguaje sencillo.
                    - No repitas ideas.
                    - Usa frases cortas.
                    - No uses listas largas.
                    Consulta: ${prompt}
        ` }],
    });

    const reply = response.choices[0].message.content;
    return reply;
}

module.exports = {
    ConsultingOpenAI
};