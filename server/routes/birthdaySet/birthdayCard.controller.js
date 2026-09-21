const { BirthdayCard } = require("../../../db/index");
const { urlDeFondoValida } = require("../joinServer/welcomeCard.controller");

const birthday_card = new BirthdayCard();

const LIMITE_CONFIG_BYTES = 32 * 1024;
const MAX_CAPAS = 12;
const MAX_ADORNOS = 200;
const MAX_COLORES = 6;
const MAX_CONTENIDO = 200;

const dentro = (valor, min, max) =>
    typeof valor === "number" && Number.isFinite(valor) && valor >= min && valor <= max;

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

    for (const capa of config.texts) {
        if (!capa || typeof capa.content !== "string") {
            return "Las capas de texto son inválidas";
        }
        // [...cadena] cuenta caracteres reales: un emoji ocupa 2 unidades UTF-16,
        // así que con .length un texto con emoji se rechazaría antes de tiempo.
        if ([...capa.content].length > MAX_CONTENIDO) {
            return `El texto de una capa supera los ${MAX_CONTENIDO} caracteres`;
        }
    }

    // Los adornos son lo propio de esta tarjeta: cada pieza es un trazo más en el
    // cron, así que conviene que el tope no dependa solo del editor.
    const deco = config.decoration;
    if (deco && typeof deco === "object") {
        if (typeof deco.amount === "number" && deco.amount > MAX_ADORNOS) {
            return `No se permiten más de ${MAX_ADORNOS} adornos`;
        }
        if (Array.isArray(deco.colors) && deco.colors.length > MAX_COLORES) {
            return `La paleta de adornos no puede tener más de ${MAX_COLORES} colores`;
        }
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
        config: body.config,
    };
}

const getBirthdayCard = async (req, res) => {
    try {
        const { serverId } = req.query;

        if (!serverId) {
            return res.status(400).json({ message: "El id del servidor es requerido" });
        }

        const setup = await birthday_card.GetById(serverId);
        return res.status(200).json({ data: setup });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * POST y PUT hacen lo mismo: como serverId es unique, el upsert resuelve los dos
 * y el panel puede reintentar sin duplicar nada.
 *
 * Acá no hace falta la regla de "enabled sin canal" que tiene la bienvenida: el
 * canal no vive en este documento, lo pone birthday_setup.
 */
const saveBirthdayCard = async (req, res, creando) => {
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

        const result = await birthday_card.Upsert(serverId, datos);

        return res.status(creando ? 201 : 200).json({
            message: creando
                ? "Imagen de cumpleaños creada con éxito"
                : "Imagen de cumpleaños actualizada con éxito",
            data: result,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const createBirthdayCard = (req, res) => saveBirthdayCard(req, res, true);
const updateBirthdayCard = (req, res) => saveBirthdayCard(req, res, false);

module.exports = {
    getBirthdayCard,
    createBirthdayCard,
    updateBirthdayCard,
};
