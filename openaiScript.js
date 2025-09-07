const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ConsultingOpenAI = async (prompt) => {

    let promptText = `
                    La siguiente consulta debe responderse en un máximo de 1900 caracteres.
                    - Sé directo, omite relleno.
                    - Resumi cualquier respuesta en algo concreto.
                    - Usa un lenguaje sencillo.
                    - No repitas ideas.
                    - Usa frases cortas.
                    - No uses listas largas.
                    Consulta: ${prompt}
        `;

    const response = await generateTexto(promptText);

    const reply = response.choices[0].message.content;
    return reply;
}

// Listas base
const razas = [
    'Humano', 'Elfo', 'Enano', 'Orco', 'Semielfo', 'Semidemonio', 'Dracónido', 'Elfo Oscuro', 'Harpia', 'Angelic', 'Elfos alados', 'Draconia', 'Slime', 'Querubines', 'Garuda', 'Kiiri', 'Demonio', 'Angeles', 'Dios', 'Semidios'
];

const clases = [
    'Guerrero', 'Mago Negro', 'Pícaro', 'Clérigo', 'Explorador', 'Bardo', 'Hechicero', 'Mago Blanco', 'Mago Rojo', 'Invocador', 'Rey Demonio', 'Archidemonio'
];

const misiones = [
    "Recuperar el Fragmento del Corazón Eterno",
    "Salvar el Bosque Negro de la corrupción",
    "Derrotar al Rey Caído que ha regresado",
    "Investigar la Torre de los Susurros",
    "Proteger el Orbe de Luz de los demonios",
    "Destruir el espejo maldito de Var-Turak",
    "Proteger la Corona del Vacío",
    "Destruir el Espejo de Sangre",
    "Rastrear el Último Titán",
    "Robar los Túneles del Eco Infinito",
    "Evitar el Secreto de los Magos Eternos",
    "Recuperar el Último Titán",
    "Encontrar el Orbe del Caos",
    "Salvar el Corazón del Bosque Prohibido",
    "Crear la Corona del Vacío",
    "Sellar el Árbol que Llora Fuego",
];


const historiasBase = [
    "Nacido en una aldea destruida por la guerra...",
    "Criado entre ladrones y comerciantes en la ciudad portuaria...",
    "Fue esclavo durante años hasta que logró escapar...",
    "Abandonado de niño en un templo mágico...",
    "Sobreviviente de una plaga mágica que mató a su familia...",
    "Fue criado por espectros que solo él podía ver. Sospecha que es una reencarnación importante.",
    "Sobrevivió a un naufragio que lo llevó a una isla mística. Siente que su destino está escrito en sangre.",
    "Fue encontrado flotando en una esfera luminosa. Siente que su destino está escrito en sangre.",
    "Su sombra tiene voluntad propia. Tiene una deuda mágica con una bruja.",
    "Nació con la habilidad de hablar con las bestias. Solo duerme una vez cada tres días.",
    "Fue el aprendiz fallido de un gran héroe. Busca una forma de ser libre.",
    "Entrenado por una orden secreta que ya no existe. Cada vez que mata, tiene un recuerdo que no es suyo.",
    "Vivió oculto en las montañas, estudiando los vientos. Desconfía del fuego y del agua por igual.",
    "Presenció un cataclismo y desde entonces puede oír los ecos del mundo. Es perseguido por una criatura invisible.",
    "Criado entre gigantes en una fortaleza de hielo. Protege a una criatura pequeña que siempre lo acompaña.",
];

const nombresRP = [
    "Kael", "Aelion", "Thorne", "Isolde", "Vaelis", "Eron", "Mira", "Zarek", "Lirael", "Sylwen",
    "Thalor", "Nyx", "Dravok", "Aerin", "Korvax", "Velira", "Maelis", "Seraphis", "Nalara", "Rhyven",
    "Alaric", "Elira", "Tavion", "Bryn", "Orin", "Selene", "Calen", "Feyra", "Lucan", "Zephyr",
    "Varek", "Ilyana", "Dorian", "Ashira", "Riven", "Kaida", "Thalric", "Nerys", "Faelan", "Ysera",
    "Talon", "Eira", "Jareth", "Kairen", "Liora", "Valken", "Sorin", "Myla", "Gideon", "Arielle",
    "Nerion", "Alira", "Korin", "Selya", "Elros", "Thalara", "Vaen", "Malric", "Shaela", "Rowan",
    "Zorion", "Anira", "Theron", "Lyra", "Cassian", "Elowen", "Dain", "Ylva", "Kaelen", "Meira",
    "Torin", "Amara", "Zenya", "Dakar", "Luneth", "Sylas", "Orielle", "Fenric", "Velena",
    "Jorund", "Iris", "Branik", "Sephira", "Arden", "Kalia", "Morric", "Naela", "Vael", "Evania",
    "Kaelor", "Syra", "Tirion", "Elaena", "Lucien", "Aenya", "Caius", "Neraya", "Auren", "Liora"
];
const apellidosRP = [
    "Sombrasol", "Corazónfuego", "Luzeterna", "Hojaoscura", "Tempestira", "Nieblaquieta", "Runasangre", "Vientoluz",
    "Furiaeterna", "Espinanegra", "Ojoalba", "Florumbra", "Puñonegro", "Sombrahelada", "Grisacerada", "Susurropiedra",
    "Danzaeco", "Almaserena", "Truenoseco", "Cenizaclara", "Ecooculto", "Filoardiente", "Espíritofrío", "Manolunar",
    "Guardanocturno", "Destelloinmortal", "Pielbruma", "Sombraviva", "Selloquebrado", "Nieblaeterna",
    "Escudoardiente", "Relámpagonegro", "Rugidooscuro", "Torregrana", "Centelladorada", "Nublanegra",
    "Duelomortal", "Silenciopétreo", "Oscuroriente", "Fulgorvacío", "Estelagrave", "Picoazur", "Luzmuda",
    "Solnaciente", "Cazadormístico", "Fauceseco", "Vigíaerrante", "Fragmentoluz", "Lágrimanegra", "Tronofrío",
    "Sombraígnea", "Garraumbría", "Ruinaeterna", "Piedrallameante", "Susurrotemido", "Luztrémula", "Tempestadgélida",
    "Ecoardiente", "Ecofinal", "Flamatorcida", "Danzaoculta", "Nieblaáspera", "Centinelasombra", "Dienteviento",
    "Anzuelooscuro", "Zarpaetérea", "Ecoenvenenado", "Alaolvidada", "Sombracarmesí", "Filooculto", "Alatempestad",
    "Maldicióneterna", "Hojaviva", "Almadesol", "Pielardiente", "Piedracalma", "Espinaceleste", "Cenizanevada",
    "Sueñofrío", "Fulgorperdido", "Cielodivino", "Trazonegro", "Centellalunar", "Murmulloeterno", "Caminoceniza",
    "Espinagélida", "Voluntadférrea", "Ojomudo", "Letrafantasma", "Vientoetéreo", "Silenciolunar", "Ecofurioso",
    "Manodeacero", "Rastrofantasma", "Broteluz", "Jadefiero", "Cenizaverde", "Florroja", "Cruzaseda", "Guardiánonírico"
];

function getNombreCompletoAleatorio() {
    const nombre = nombresRP[Math.floor(Math.random() * nombresRP.length)];
    const apellido = apellidosRP[Math.floor(Math.random() * apellidosRP.length)];
    return `${nombre} ${apellido}`;
}

const generarEstadisticas = () => ({
    fuerza: Math.floor(Math.random() * 6) + 10,
    destreza: Math.floor(Math.random() * 6) + 10,
    constitucion: Math.floor(Math.random() * 6) + 10,
    inteligencia: Math.floor(Math.random() * 6) + 10,
    sabiduria: Math.floor(Math.random() * 6) + 10,
    carisma: Math.floor(Math.random() * 6) + 10,
});

const createCharacter = async () => {
    try {
        const raza = razas[Math.floor(Math.random() * razas.length)];
        const clase = clases[Math.floor(Math.random() * clases.length)];
        const mision = misiones[Math.floor(Math.random() * misiones.length)];
        const baseHistoria = historiasBase[Math.floor(Math.random() * historiasBase.length)];

        const nombre = getNombreCompletoAleatorio();
        const estadisticas = generarEstadisticas();

        const promptHistoria = `
        Crea una historia para un personaje de rol estilo fantasía medieval.
        Su nombre es ${nombre} y es un ${raza.toLowerCase()} con clase ${clase.toLowerCase()} de nivel 1.
        Su misión es: ${mision}.
        Sus Estadisticas:
            Fuerza: ${estadisticas.fuerza}
            Destreza: ${estadisticas.destreza}
            Constitucion: ${estadisticas.constitucion}
            Inteligencia: ${estadisticas.inteligencia}
            Sabiduria: ${estadisticas.sabiduria}
            Carisma: ${estadisticas.carisma}
        Parte de la historia debe girar en torno a: ${baseHistoria}
        Hazlo breve (máx 1900 caracteres), directo y con una personalidad única.
        `;

        const completion = await generateTexto(promptHistoria);

        const historia = completion.choices[0].message.content;

        const promptImagen = `Un ${raza.toLowerCase()} ${clase.toLowerCase()}, estilo arte de fantasía medieval, con vestimenta y armas típicas, en un entorno épico, detalle realista, usado para el rolplay`;

        const image = await generateImage(promptImagen);

        return {
            nombre,
            raza,
            clase,
            nivel: 1,
            mision,
            estadisticas,
            historia,
            imagen: image.data[0].url,
            error: ''
        };

    } catch (err) {
        console.error(err);
        return { error: 'Error al generar personaje' };
    }
}


const generateTexto = async (promptText) => {

    return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
            role: "user", content: promptText
        }],
    });
}

const generateImage = async (prompt, number, model) => {

    const image = await openai.images.generate({
        prompt: prompt,
        model: model || "dall-e-3",
        n: number || 1,
        size: "1024x1024"
    });

    return image;
}

module.exports = {
    ConsultingOpenAI,
    createCharacter,
    generateImage
};