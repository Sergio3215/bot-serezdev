const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const {
    cargarFuentes,
    resolverFuente,
    urlDirecta,
    encuadrar,
    hexARgba,
    degradado,
    trazarForma,
    limpiarEfectos,
} = require("./welcomeCard");

/**
 * Dibuja la tarjeta de cumpleaños a partir del diseño que arma el panel web.
 *
 * Es la hermana de welcomeCard.js y comparte con ella las fuentes y los helpers
 * de dibujo. Dos cosas la diferencian:
 *
 *  1. Las variables van con `$` ($nombre, $edad...), como el mensaje de cumpleaños,
 *     no con `{}` como la bienvenida.
 *  2. Tiene adornos: confeti, globos, estrellas o corazones, dibujados por código
 *     entre el fondo y el avatar.
 *
 * El orden de dibujo y las cuentas son los mismos que en la vista previa del panel
 * (lib/birthdayCard.ts de serezdev-bot-page). Si tocás uno, tocá el otro.
 */

/* ------------------------------------------------------------------ */
/* Emoji                                                               */
/* ------------------------------------------------------------------ */

/**
 * Nombre con el que hay que registrar la fuente de emoji, si la querés:
 *
 *   static/fonts/NotoColorEmoji.ttf  →  se registra sola por loadFontsFromDir
 *
 * Mientras no esté, los 🎂 y 🎉 de las plantillas salen como cuadraditos. No
 * rompe nada: el resto del texto se dibuja igual.
 */
const FAMILIA_EMOJI = "Noto Color Emoji";

/**
 * Agrega la familia de emoji como respaldo de la familia de la capa.
 *
 * `resolverFuente()` devuelve una sola familia, así que sin esto el emoji nunca
 * tendría de dónde salir: Skia no hace el fallback automático del navegador, y
 * si la familia no figura en el string de `ctx.font`, no se usa.
 *
 * Si la fuente no está registrada devolvemos la familia sola, para no ensuciar
 * el `font` con una familia inexistente.
 */
function conRespaldoDeEmoji(familia) {
    try {
        if (GlobalFonts.has(FAMILIA_EMOJI)) return `"${familia}", "${FAMILIA_EMOJI}"`;
    } catch (error) {
        // GlobalFonts.has puede no existir en versiones viejas: seguimos de largo.
    }

    return `"${familia}"`;
}

/* ------------------------------------------------------------------ */
/* Variables del texto                                                 */
/* ------------------------------------------------------------------ */

function formatearFecha(date) {
    return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(date);
}

/**
 * Reemplaza $nombre, $usuario, $edad, $servidor y $fecha.
 *
 * `edad` en null es el miembro que nunca cargó su año de nacimiento: la variable
 * se va y queda un hueco, así que después se colapsan los espacios. Sin eso,
 * "Hoy cumple $edad años" quedaría con doble espacio y no coincidiría con la
 * vista previa del panel.
 */
function aplicarVariables(texto, datos) {
    const edad = datos.age == null ? "" : String(datos.age);
    const fecha = datos.date || formatearFecha(new Date());

    return String(texto || "")
        .replace(/\$nombre/g, datos.displayName)
        .replace(/\$usuario/g, datos.username)
        .replace(/\$servidor/g, datos.serverName)
        .replace(/\$fecha/g, fecha)
        .replace(/\$edad/g, edad)
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+\n/g, "\n");
}

/* ------------------------------------------------------------------ */
/* Adornos                                                             */
/* ------------------------------------------------------------------ */

/**
 * mulberry32: el mismo generador pseudoaleatorio que usa el panel.
 *
 * Tiene que ser bit a bit idéntico, y las llamadas tienen que salir en el mismo
 * orden (color, x, y, tamaño, ángulo). Con Math.random() el confeti caería en
 * otro lado que en la vista previa y el admin no podría diseñar nada.
 */
function mulberry32(semilla) {
    let t = semilla >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function trazarEstrella(ctx, tamano) {
    const externo = tamano / 2;
    const interno = externo * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radio = i % 2 === 0 ? externo : interno;
        const angulo = (Math.PI / 5) * i - Math.PI / 2;
        const px = Math.cos(angulo) * radio;
        const py = Math.sin(angulo) * radio;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function trazarCorazon(ctx, tamano) {
    const s = tamano / 2;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.3, -s * 0.5, -s * 1.15, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.5, -s * 1.15, s * 1.4, -s * 0.3, 0, s * 0.8);
    ctx.closePath();
}

function trazarGlobo(ctx, tamano) {
    const rx = tamano * 0.36;
    const ry = tamano * 0.46;

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // El nudo.
    ctx.beginPath();
    ctx.moveTo(-rx * 0.2, ry * 0.95);
    ctx.lineTo(rx * 0.2, ry * 0.95);
    ctx.lineTo(0, ry * 1.25);
    ctx.closePath();
    ctx.fill();

    // El hilo.
    ctx.beginPath();
    ctx.moveTo(0, ry * 1.25);
    ctx.quadraticCurveTo(rx * 0.8, ry * 1.9, 0, ry * 2.7);
    ctx.lineWidth = Math.max(1, tamano * 0.035);
    ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Defensa contra configs viejas o incompletas                         */
/* ------------------------------------------------------------------ */

const num = (v, def) => (typeof v === "number" && Number.isFinite(v) ? v : def);
const txt = (v, def) => (typeof v === "string" && v.length > 0 ? v : def);
const bool = (v, def) => (typeof v === "boolean" ? v : def);

/**
 * Completa lo que falte para que un diseño viejo no tire el cron de cumpleaños.
 * El panel ya normaliza al guardar; esto es el cinturón de seguridad.
 */
function normalizar(config) {
    const cfg = config && typeof config === "object" ? config : {};
    const canvas = cfg.canvas || {};
    const bg = cfg.background || {};
    const grad = bg.gradient || {};
    const deco = cfg.decoration || {};
    const av = cfg.avatar || {};

    const width = num(canvas.width, 1024);
    const height = num(canvas.height, 500);

    const colores = Array.isArray(deco.colors)
        ? deco.colors.filter((c) => typeof c === "string" && c.length > 0)
        : [];

    return {
        canvas: { width, height },
        background: {
            type: ["color", "gradient", "image"].includes(bg.type) ? bg.type : "gradient",
            color: txt(bg.color, "#1e1f22"),
            gradient: {
                from: txt(grad.from, "#241a4f"),
                to: txt(grad.to, "#f0b232"),
                angle: num(grad.angle, 135),
            },
            imageUrl: typeof bg.imageUrl === "string" ? bg.imageUrl : null,
            fit: ["cover", "contain", "stretch"].includes(bg.fit) ? bg.fit : "cover",
            overlayColor: txt(bg.overlayColor, "#000000"),
            overlayOpacity: num(bg.overlayOpacity, 0),
        },
        decoration: {
            type: ["none", "confetti", "balloons", "stars", "hearts"].includes(deco.type)
                ? deco.type
                : "none",
            amount: num(deco.amount, 0),
            colors: colores.length > 0 ? colores : ["#ffffff"],
            seed: num(deco.seed, 1),
            opacity: num(deco.opacity, 0.9),
            size: num(deco.size, 18),
        },
        avatar: {
            enabled: bool(av.enabled, true),
            x: num(av.x, width / 2),
            y: num(av.y, height / 3),
            size: num(av.size, 160),
            shape: ["circle", "rounded", "square"].includes(av.shape) ? av.shape : "circle",
            radius: num(av.radius, 32),
            borderWidth: num(av.borderWidth, 8),
            borderColor: txt(av.borderColor, "#f0b232"),
            shadowBlur: num(av.shadowBlur, 28),
            shadowColor: txt(av.shadowColor, "#000000"),
        },
        texts: (Array.isArray(cfg.texts) ? cfg.texts : []).map((t) => ({
            content: typeof t.content === "string" ? t.content : "",
            x: num(t.x, width / 2),
            y: num(t.y, height / 2),
            align: ["left", "center", "right"].includes(t.align) ? t.align : "center",
            fontFamily: txt(t.fontFamily, "Arial, Helvetica, sans-serif"),
            fontSize: num(t.fontSize, 40),
            fontWeight: num(t.fontWeight, 700),
            italic: bool(t.italic, false),
            uppercase: bool(t.uppercase, false),
            color: txt(t.color, "#ffffff"),
            opacity: num(t.opacity, 1),
            lineHeight: num(t.lineHeight, 1.2),
            maxWidth: t.maxWidth == null ? null : num(t.maxWidth, null),
            strokeWidth: num(t.strokeWidth, 0),
            strokeColor: txt(t.strokeColor, "#000000"),
            shadowBlur: num(t.shadowBlur, 0),
            shadowOffsetX: num(t.shadowOffsetX, 0),
            shadowOffsetY: num(t.shadowOffsetY, 0),
            shadowColor: txt(t.shadowColor, "#000000"),
        })),
    };
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

class BirthdayCardRenderer {
    constructor() {
        // Comparte el registro con la bienvenida: si ya corrió, no hace nada.
        cargarFuentes();
    }

    /**
     * Descarga el fondo y el avatar. Si alguno falla, se sigue igual: se pierde
     * ese pedazo, no la tarjeta.
     */
    async #cargarImagenes(config, avatarUrl) {
        const imagenes = { background: null, avatar: null };

        if (config.background.type === "image" && config.background.imageUrl) {
            const url = urlDirecta(config.background.imageUrl);

            try {
                imagenes.background = await loadImage(url);
            } catch (error) {
                console.log("[birthdayCard] no se pudo bajar el fondo:", error.message);
            }
        }

        if (avatarUrl) {
            try {
                imagenes.avatar = await loadImage(avatarUrl);
            } catch (error) {
                console.log("[birthdayCard] no se pudo bajar el avatar:", error.message);
            }
        }

        return imagenes;
    }

    #dibujarFondo(ctx, config, imagenes) {
        const { width, height } = config.canvas;
        const bg = config.background;

        if (bg.type === "image" && imagenes.background) {
            const { dx, dy, dw, dh } = encuadrar(
                imagenes.background.width,
                imagenes.background.height,
                width,
                height,
                bg.fit
            );
            ctx.fillStyle = bg.color;
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(imagenes.background, dx, dy, dw, dh);
        } else if (bg.type === "gradient") {
            ctx.fillStyle = degradado(ctx, width, height, bg.gradient.angle, bg.gradient.from, bg.gradient.to);
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = bg.color;
            ctx.fillRect(0, 0, width, height);
        }

        if (bg.overlayOpacity > 0) {
            ctx.fillStyle = hexARgba(bg.overlayColor, bg.overlayOpacity);
            ctx.fillRect(0, 0, width, height);
        }
    }

    /** Van sobre el fondo y detrás del avatar: nunca tapan lo que importa. */
    #dibujarAdornos(ctx, config) {
        const deco = config.decoration;
        if (deco.type === "none" || deco.amount <= 0 || deco.opacity <= 0) return;

        const { width, height } = config.canvas;
        const colores = deco.colors;
        const random = mulberry32(deco.seed || 1);

        ctx.save();
        limpiarEfectos(ctx);
        ctx.globalAlpha = deco.opacity;

        for (let i = 0; i < deco.amount; i++) {
            const color = colores[Math.floor(random() * colores.length) % colores.length];
            const x = random() * width;
            // Los globos flotan: se juntan arriba en vez de repartirse por todo el lienzo.
            const y = deco.type === "balloons" ? random() * height * 0.72 : random() * height;
            const tamano = deco.size * (0.6 + random() * 0.8);
            const angulo = (random() - 0.5) * Math.PI;

            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            if (deco.type === "confetti") {
                ctx.rotate(angulo);
                // Mitad tiras, mitad puntos: sin la mezcla parece una grilla.
                if (i % 3 === 0) {
                    ctx.beginPath();
                    ctx.arc(0, 0, tamano * 0.22, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-tamano / 2, -tamano * 0.18, tamano, tamano * 0.36);
                }
            } else if (deco.type === "balloons") {
                trazarGlobo(ctx, tamano * 1.6);
            } else if (deco.type === "stars") {
                ctx.rotate(angulo * 0.3);
                trazarEstrella(ctx, tamano);
                ctx.fill();
            } else {
                ctx.rotate(angulo * 0.2);
                trazarCorazon(ctx, tamano);
                ctx.fill();
            }

            ctx.restore();
        }

        ctx.restore();
    }

    #dibujarAvatar(ctx, config, imagenes) {
        const av = config.avatar;
        if (!av.enabled) return;

        const mitad = av.size / 2;

        if (av.shadowBlur > 0) {
            ctx.save();
            ctx.shadowBlur = av.shadowBlur;
            ctx.shadowColor = av.shadowColor;
            ctx.fillStyle = "rgba(0,0,0,1)";
            trazarForma(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        trazarForma(ctx, av.shape, av.x, av.y, av.size, av.radius);
        ctx.clip();
        if (imagenes.avatar) {
            const { dx, dy, dw, dh } = encuadrar(
                imagenes.avatar.width,
                imagenes.avatar.height,
                av.size,
                av.size,
                "cover"
            );
            ctx.drawImage(imagenes.avatar, av.x - mitad + dx, av.y - mitad + dy, dw, dh);
        } else {
            ctx.fillStyle = "#2b2d31";
            ctx.fill();
        }
        ctx.restore();

        if (av.borderWidth > 0) {
            ctx.save();
            limpiarEfectos(ctx);
            trazarForma(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.lineWidth = av.borderWidth;
            ctx.strokeStyle = av.borderColor;
            ctx.stroke();
            ctx.restore();
        }
    }

    #dibujarTextos(ctx, config, datos) {
        for (const capa of config.texts) {
            const crudo = aplicarVariables(capa.content, datos);
            const texto = capa.uppercase ? crudo.toUpperCase() : crudo;
            const lineas = texto.split("\n");

            const familia = conRespaldoDeEmoji(resolverFuente(capa.fontFamily));
            const fuente = (tam) => `${capa.italic ? "italic " : ""}${capa.fontWeight} ${tam}px ${familia}`;

            ctx.save();

            // Si hay maxWidth y el texto no entra, se achica la fuente hasta que entre.
            let tam = capa.fontSize;
            ctx.font = fuente(tam);
            if (capa.maxWidth && capa.maxWidth > 0) {
                const natural = Math.max(...lineas.map((l) => ctx.measureText(l).width), 1);
                if (natural > capa.maxWidth) {
                    tam = Math.max(8, Math.floor(tam * (capa.maxWidth / natural)));
                    ctx.font = fuente(tam);
                }
            }

            ctx.textAlign = capa.align;
            ctx.textBaseline = "middle";
            ctx.globalAlpha = capa.opacity;

            const altoLinea = tam * capa.lineHeight;
            const altoBloque = altoLinea * lineas.length;
            const primeraY = capa.y - altoBloque / 2 + altoLinea / 2;

            lineas.forEach((linea, i) => {
                const y = primeraY + i * altoLinea;

                if (capa.shadowBlur > 0 || capa.shadowOffsetX !== 0 || capa.shadowOffsetY !== 0) {
                    ctx.shadowBlur = capa.shadowBlur;
                    ctx.shadowOffsetX = capa.shadowOffsetX;
                    ctx.shadowOffsetY = capa.shadowOffsetY;
                    ctx.shadowColor = capa.shadowColor;
                }

                if (capa.strokeWidth > 0) {
                    ctx.lineJoin = "round";
                    ctx.miterLimit = 2;
                    ctx.lineWidth = capa.strokeWidth * 2;
                    ctx.strokeStyle = capa.strokeColor;
                    ctx.strokeText(linea, capa.x, y);
                }

                limpiarEfectos(ctx); // que la sombra no se dibuje dos veces
                ctx.fillStyle = capa.color;
                ctx.fillText(linea, capa.x, y);
            });

            ctx.restore();
        }
    }

    /**
     * @param {Object} config  El campo `config` de birthday_card
     * @param {Object} datos   { displayName, username, serverName, age, date, avatarUrl }
     * @returns {Promise<Buffer>} PNG listo para adjuntar
     */
    async Render(config, datos) {
        const cfg = normalizar(config);

        const imagenes = await this.#cargarImagenes(cfg, datos.avatarUrl);

        const canvas = createCanvas(cfg.canvas.width, cfg.canvas.height);
        const ctx = canvas.getContext("2d");

        this.#dibujarFondo(ctx, cfg, imagenes);
        this.#dibujarAdornos(ctx, cfg);
        this.#dibujarAvatar(ctx, cfg, imagenes);
        this.#dibujarTextos(ctx, cfg, datos);

        return await canvas.encode("png");
    }

    /**
     * Arma el `files` para channel.send(). El texto no sale de acá: lo sigue
     * poniendo el cron con el mensaje de birthday_setup.
     *
     * Devuelve [] si no hay diseño, si está desactivado o si el dibujo falla, así
     * que el saludo nunca se pierde por culpa de la imagen.
     *
     * @param {Object} row     El documento de birthday_card, o null
     * @param {Object} member  GuildMember del cumpleañero
     * @param {number|null} edad  Los años que cumple, o null si no cargó el año
     */
    async BuildFiles(row, member, edad) {
        if (!row || !row.enabled || !row.config) return [];

        try {
            const datos = {
                displayName: member.displayName || member.user.username,
                username: member.user.username,
                serverName: member.guild.name,
                age: edad,
                date: "", // vacío = la fecha de hoy
                avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 512 }),
            };

            const png = await this.Render(row.config, datos);

            return [{ attachment: png, name: "cumple.png" }];
        } catch (error) {
            console.log("[birthdayCard] no se pudo dibujar la tarjeta:", error.message);
            return [];
        }
    }
}

module.exports = {
    BirthdayCardRenderer,
    aplicarVariables,
    normalizar,
};
