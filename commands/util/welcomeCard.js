const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

/**
 * Dibuja la tarjeta de bienvenida a partir del diseño que arma el panel web.
 *
 * En la base no se guarda una imagen sino la "receta" (el campo `config` de
 * welcome_card). Acá se convierte esa receta en un PNG, ya con el avatar y el
 * nombre reales del miembro que acaba de entrar.
 *
 * El orden de dibujo y las cuentas son los mismos que en la vista previa del
 * panel (lib/welcomeCard.ts de serezdev-bot-page). Si tocás uno, tocá el otro.
 */

/* ------------------------------------------------------------------ */
/* Fuentes                                                             */
/* ------------------------------------------------------------------ */

const CARPETA_FUENTES = path.join(__dirname, "..", "..", "static", "fonts");

/**
 * Equivalentes libres (Google Fonts) de las familias que ofrece el editor.
 *
 * @napi-rs/canvas no trae ninguna fuente: usa las del sistema. Windows tiene casi
 * 200 familias, pero un contenedor Linux como el de Railway puede no tener ninguna,
 * y sin fuentes el texto se mide con ancho 0 y no se dibuja nada: queda el fondo y
 * el avatar, sin letras.
 *
 * Cada archivo se registra además con el nombre que usa el editor, así "Arial"
 * existe aunque el sistema no la tenga. Arimo, Tinos y Cousine comparten las
 * métricas exactas de Arial, Times New Roman y Courier New, así que el texto ocupa
 * lo mismo que en la vista previa. El resto son aproximaciones visuales.
 */
const ARIMO = ["Arimo-400.ttf", "Arimo-700.ttf", "Arimo-400Italic.ttf", "Arimo-700Italic.ttf"];
const TINOS = ["Tinos-400.ttf", "Tinos-700.ttf", "Tinos-400Italic.ttf"];
const COUSINE = ["Cousine-400.ttf", "Cousine-700.ttf"];
const COMIC = ["ComicNeue-400.ttf", "ComicNeue-700.ttf"];

const FUENTES = [
    { alias: "Arial", archivos: ARIMO },
    { alias: "Helvetica", archivos: ARIMO },
    { alias: "Verdana", archivos: ARIMO },
    { alias: "Trebuchet MS", archivos: ["FiraSans-400.ttf", "FiraSans-700.ttf"] },
    { alias: "Georgia", archivos: ["Gelasio-400.ttf", "Gelasio-700.ttf"] },
    { alias: "Times New Roman", archivos: TINOS },
    { alias: "Courier New", archivos: COUSINE },
    { alias: "Impact", archivos: ["Anton-400.ttf"] },
    { alias: "Comic Sans MS", archivos: COMIC },
    // Genéricos de CSS, por si una capa vieja quedó solo con esto.
    { alias: "sans-serif", archivos: ARIMO },
    { alias: "serif", archivos: TINOS },
    { alias: "monospace", archivos: COUSINE },
    { alias: "cursive", archivos: COMIC },
];

let fuentesCargadas = false;

function cargarFuentes() {
    if (fuentesCargadas) return;
    fuentesCargadas = true;

    try {
        // 1. Todo lo que haya en la carpeta, con su nombre real (Arimo, Tinos...).
        const propias = GlobalFonts.loadFontsFromDir(CARPETA_FUENTES);

        // 2. Y de nuevo bajo el nombre que guarda el editor, para que resuelvan
        //    aunque el sistema operativo no tenga esas familias.
        let alias = 0;
        for (const fuente of FUENTES) {
            for (const archivo of fuente.archivos) {
                const ruta = path.join(CARPETA_FUENTES, archivo);
                if (!fs.existsSync(ruta)) continue;

                try {
                    GlobalFonts.registerFromPath(ruta, fuente.alias);
                    alias++;
                } catch (error) {
                    console.log(`[welcomeCard] no se pudo registrar ${archivo} como "${fuente.alias}":`, error.message);
                }
            }
        }

        const total = GlobalFonts.families.length;
        console.log(`[welcomeCard] fuentes: ${propias} archivos propios, ${alias} alias, ${total} familias disponibles`);

        if (total === 0) {
            console.log("[welcomeCard] ¡SIN NINGUNA FUENTE! El texto no se va a dibujar. Faltan los .ttf en static/fonts.");
        }
    } catch (error) {
        console.log("[welcomeCard] no se pudieron cargar las fuentes:", error.message);
    }
}

/**
 * El panel guarda pilas de CSS ("Arial, Helvetica, sans-serif"). Devuelve la
 * primera familia que el bot tenga realmente registrada.
 */
function resolverFuente(pila) {
    const familias = String(pila || "")
        .split(",")
        .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);

    for (const familia of familias) {
        try {
            if (GlobalFonts.has(familia)) return familia;
        } catch (error) {
            // GlobalFonts.has puede no existir en versiones viejas: seguimos de largo.
        }
    }

    // Última red: antes que no dibujar nada, dibujar con cualquier familia que haya.
    try {
        const disponibles = GlobalFonts.families;
        if (disponibles.length > 0) return disponibles[0].family;
    } catch (error) {
        // sin families: caemos al nombre original
    }

    return familias[0] || "sans-serif";
}

/* ------------------------------------------------------------------ */
/* Variables del texto                                                 */
/* ------------------------------------------------------------------ */

/**
 * Reemplaza {user}, {username}, {server} y {count}.
 * El formato de {count} tiene que coincidir con el del panel o la vista previa miente.
 */
function aplicarVariables(texto, datos) {
    return String(texto || "")
        .replace(/\{user\}/g, datos.displayName)
        .replace(/\{username\}/g, datos.username)
        .replace(/\{server\}/g, datos.serverName)
        .replace(/\{count\}/g, new Intl.NumberFormat("es-AR").format(datos.memberCount));
}

/* ------------------------------------------------------------------ */
/* URLs de Drive / OneDrive                                            */
/* ------------------------------------------------------------------ */

const DRIVE_ID = "[A-Za-z0-9_-]{10,}";

const DRIVE_PATRONES = [
    new RegExp(`drive\\.google\\.com/file/d/(${DRIVE_ID})`),
    new RegExp(`(?:drive|docs)\\.google\\.com/(?:uc|open)\\?[^\\s]*id=(${DRIVE_ID})`),
    new RegExp(`drive\\.google\\.com/thumbnail\\?[^\\s]*id=(${DRIVE_ID})`),
];

/**
 * Los links de "compartir" de Drive y OneDrive devuelven HTML, no la imagen.
 * Esta es la misma conversión que hace el panel (lib/imageUrl.ts), replicada acá
 * para las configs que se hayan guardado antes o editado a mano en la base.
 */
function urlDirecta(url) {
    const limpia = String(url || "").trim();
    if (!limpia) return limpia;

    for (const patron of DRIVE_PATRONES) {
        const match = limpia.match(patron);
        if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }

    if (/(?:1drv\.ms|onedrive\.live\.com|\.sharepoint\.com)\//.test(limpia)) {
        const codificada = Buffer.from(limpia, "utf8")
            .toString("base64")
            .replace(/=+$/, "")
            .replace(/\//g, "_")
            .replace(/\+/g, "-");

        return `https://api.onedrive.com/v1.0/shares/u!${codificada}/root/content`;
    }

    return limpia;
}

/* ------------------------------------------------------------------ */
/* Helpers de dibujo                                                   */
/* ------------------------------------------------------------------ */

function encuadrar(iw, ih, w, h, modo) {
    if (modo === "stretch" || !iw || !ih) return { dx: 0, dy: 0, dw: w, dh: h };
    const escala = modo === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const dw = iw * escala;
    const dh = ih * escala;
    return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

function hexARgba(hex, alpha) {
    const limpio = String(hex || "#000000").replace("#", "");
    const completo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
    const n = parseInt(completo, 16);
    if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function degradado(ctx, w, h, angulo, desde, hasta) {
    // 0° = de abajo hacia arriba, 90° = de izquierda a derecha (igual que CSS).
    const rad = ((angulo - 90) * Math.PI) / 180;
    const largo = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const dx = (Math.cos(rad) * largo) / 2;
    const dy = (Math.sin(rad) * largo) / 2;
    const grad = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    grad.addColorStop(0, desde);
    grad.addColorStop(1, hasta);
    return grad;
}

function trazarForma(ctx, forma, x, y, tamano, radio) {
    const mitad = tamano / 2;
    ctx.beginPath();
    if (forma === "circle") {
        ctx.arc(x, y, mitad, 0, Math.PI * 2);
    } else if (forma === "rounded" && typeof ctx.roundRect === "function") {
        ctx.roundRect(x - mitad, y - mitad, tamano, tamano, Math.min(radio, mitad));
    } else {
        ctx.rect(x - mitad, y - mitad, tamano, tamano);
    }
    ctx.closePath();
}

function limpiarEfectos(ctx) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "transparent";
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

class WelcomeCardRenderer {
    constructor() {
        cargarFuentes();
    }

    /**
     * Descarga el fondo y el avatar. Si el fondo falla, se sigue igual: se pierde
     * la imagen pero la bienvenida se manda.
     */
    async #cargarImagenes(config, avatarUrl) {
        const imagenes = { background: null, avatar: null };

        if (config.background.type === "image" && config.background.imageUrl) {
            // El panel ya guarda la URL directa, pero una config vieja (o editada a
            // mano en la base) puede tener todavía el link de "compartir".
            const url = urlDirecta(config.background.imageUrl);

            try {
                imagenes.background = await loadImage(url);
            } catch (error) {
                console.log("[welcomeCard] no se pudo bajar el fondo:", error.message);
            }
        }

        if (avatarUrl) {
            try {
                imagenes.avatar = await loadImage(avatarUrl);
            } catch (error) {
                console.log("[welcomeCard] no se pudo bajar el avatar:", error.message);
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

            const familia = resolverFuente(capa.fontFamily);
            const fuente = (tam) => `${capa.italic ? "italic " : ""}${capa.fontWeight} ${tam}px "${familia}"`;

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
     * @param {Object} config  El campo `config` de welcome_card
     * @param {Object} datos   { displayName, username, serverName, memberCount, avatarUrl }
     * @returns {Promise<Buffer>} PNG listo para adjuntar
     */
    async Render(config, datos) {
        const cfg = normalizar(config);

        const imagenes = await this.#cargarImagenes(cfg, datos.avatarUrl);

        const canvas = createCanvas(cfg.canvas.width, cfg.canvas.height);
        const ctx = canvas.getContext("2d");

        this.#dibujarFondo(ctx, cfg, imagenes);
        this.#dibujarAvatar(ctx, cfg, imagenes);
        this.#dibujarTextos(ctx, cfg, datos);

        return await canvas.encode("png");
    }

    /**
     * Arma el objeto listo para channel.send(): la imagen y, si hay, el texto
     * que la acompaña con las variables ya reemplazadas.
     */
    async BuildMessage(row, member) {
        const datos = {
            displayName: member.displayName || member.user.username,
            username: member.user.username,
            serverName: member.guild.name,
            memberCount: member.guild.memberCount,
            avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 512 }),
        };

        const png = await this.Render(row.config, datos);

        const contenido = aplicarVariables(row.messageContent, datos)
            .replace(/\{mention\}/g, `<@${member.id}>`)
            .trim();

        const mensaje = {
            files: [{ attachment: png, name: "bienvenida.png" }],
        };

        // Discord rechaza content vacío: solo lo mandamos si el admin escribió algo.
        if (contenido) mensaje.content = contenido;

        return mensaje;
    }
}

/* ------------------------------------------------------------------ */
/* Defensa contra configs viejas o incompletas                         */
/* ------------------------------------------------------------------ */

const num = (v, def) => (typeof v === "number" && Number.isFinite(v) ? v : def);
const txt = (v, def) => (typeof v === "string" && v.length > 0 ? v : def);
const bool = (v, def) => (typeof v === "boolean" ? v : def);

/**
 * Completa lo que falte para que un diseño viejo no tire el guildMemberAdd.
 * El panel ya normaliza al guardar; esto es el cinturón de seguridad.
 */
function normalizar(config) {
    const cfg = config && typeof config === "object" ? config : {};
    const canvas = cfg.canvas || {};
    const bg = cfg.background || {};
    const grad = bg.gradient || {};
    const av = cfg.avatar || {};

    const width = num(canvas.width, 1024);
    const height = num(canvas.height, 500);

    return {
        canvas: { width, height },
        background: {
            type: ["color", "gradient", "image"].includes(bg.type) ? bg.type : "gradient",
            color: txt(bg.color, "#1e1f22"),
            gradient: {
                from: txt(grad.from, "#1e1f22"),
                to: txt(grad.to, "#5865F2"),
                angle: num(grad.angle, 135),
            },
            imageUrl: typeof bg.imageUrl === "string" ? bg.imageUrl : null,
            fit: ["cover", "contain", "stretch"].includes(bg.fit) ? bg.fit : "cover",
            overlayColor: txt(bg.overlayColor, "#000000"),
            overlayOpacity: num(bg.overlayOpacity, 0),
        },
        avatar: {
            enabled: bool(av.enabled, true),
            x: num(av.x, width / 2),
            y: num(av.y, height / 3),
            size: num(av.size, 180),
            shape: ["circle", "rounded", "square"].includes(av.shape) ? av.shape : "circle",
            radius: num(av.radius, 32),
            borderWidth: num(av.borderWidth, 8),
            borderColor: txt(av.borderColor, "#5865F2"),
            shadowBlur: num(av.shadowBlur, 24),
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

module.exports = {
    WelcomeCardRenderer,
    aplicarVariables,
    normalizar,
};
