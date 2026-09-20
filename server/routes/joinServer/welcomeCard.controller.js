const { WelcomeCard } = require("../../../db/index");

const welcome_card = new WelcomeCard();

const LIMITE_CONFIG_BYTES = 32 * 1024;
const MAX_CAPAS = 12;
const MAX_MENSAJE = 2000; // límite de Discord

/**
 * Hosts a los que se le permite al bot pedir el fondo. Si WELCOME_BG_HOSTS está
 * vacío se acepta cualquier https, salvo direcciones internas.
 * Ejemplo: WELCOME_BG_HOSTS="cdn.discordapp.com,i.imgur.com"
 */
const HOSTS_PERMITIDOS = (process.env.WELCOME_BG_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

const dentro = (valor, min, max) =>
    typeof valor === "number" && Number.isFinite(valor) && valor >= min && valor <= max;

/**
 * El bot descarga esta URL cada vez que entra un miembro, así que no puede
 * apuntar a la red interna: sería un SSRF con el bot de intermediario.
 */
function urlDeFondoValida(url) {
    let parsed;

    try {
        parsed = new URL(url);
    } catch (error) {
        return "El fondo tiene que ser una URL válida";
    }

    if (parsed.protocol !== "https:") return "El fondo tiene que ser una URL https";

    const host = parsed.hostname.toLowerCase();

    const esInterno =
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".internal") ||
        host === "[::1]" ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    if (esInterno) return "El fondo no puede apuntar a una dirección interna";

    if (HOSTS_PERMITIDOS.length > 0 && !HOSTS_PERMITIDOS.includes(host)) {
        return `El dominio del fondo no está permitido (${host})`;
    }

    return null;
}

/**
 * Valida sin reescribir: el panel ya normaliza al guardar, y si acá
 * "arregláramos" el objeto le borraríamos campos que el editor necesita para
 * volver a abrirlo (id y label de cada capa, letterSpacing, blur...).
 */
function validarConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return "El diseño es inválido";
    }

    if (Buffer.byteLength(JSON.stringify(config), "utf8") > LIMITE_CONFIG_BYTES) {
        return "El diseño es demasiado grande";
    }

    const canvas = config.canvas;
    if (!canvas || !dentro(canvas.width, 200, 2048) || !dentro(canvas.height, 200, 2048)) {
        return "El tamaño del lienzo es inválido";
    }

    if (!Array.isArray(config.texts)) {
        return "Las capas de texto son inválidas";
    }

    if (config.texts.length > MAX_CAPAS) {
        return `No se permiten más de ${MAX_CAPAS} capas de texto`;
    }

    const imageUrl = config.background && config.background.imageUrl;
    if (imageUrl !== null && imageUrl !== undefined && imageUrl !== "") {
        if (typeof imageUrl !== "string") return "El fondo es inválido";
        const error = urlDeFondoValida(imageUrl);
        if (error) return error;
    }

    return null;
}

/** Arma el objeto a guardar con todos los campos explícitos. */
function armarDatos(body) {
    return {
        enabled: typeof body.enabled === "boolean" ? body.enabled : true,
        channelId: body.channelId || null,
        messageContent: String(body.messageContent || "").slice(0, MAX_MENSAJE),
        config: body.config,
    };
}

const getWelcomeCard = async (req, res) => {
    try {
        const { serverId } = req.query;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const setup = await welcome_card.GetById(serverId);
        return res.status(200).json({ data: setup });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * POST y PUT hacen lo mismo: como serverId es unique, el upsert resuelve los dos
 * y el panel puede reintentar sin duplicar nada.
 */
const saveWelcomeCard = async (req, res, creando) => {
    try {
        const { serverId } = req.body;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const error = validarConfig(req.body.config);
        if (error) {
            return res.status(400).json({ message: error });
        }

        const datos = armarDatos(req.body);

        if (datos.enabled && !datos.channelId) {
            return res.status(400).json({ message: "Elegí el canal donde se publica la bienvenida" });
        }

        const result = await welcome_card.Upsert(serverId, datos);

        return res.status(creando ? 201 : 200).json({
            message: creando
                ? "Imagen de bienvenida creada con éxito"
                : "Imagen de bienvenida actualizada con éxito",
            data: result,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const createWelcomeCard = (req, res) => saveWelcomeCard(req, res, true);
const updateWelcomeCard = (req, res) => saveWelcomeCard(req, res, false);

module.exports = {
    getWelcomeCard,
    createWelcomeCard,
    updateWelcomeCard,
};
