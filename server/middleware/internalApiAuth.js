const crypto = require("node:crypto");

/**
 * Protege las rutas internas que pueden consultar o modificar una suscripcion.
 * El secreto se lee en cada request para que los tests y los procesos que cargan
 * dotenv despues de las rutas usen siempre el valor actual.
 */
function internalApiAuth(req, res, next) {
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    const authorization = req.get("authorization") || "";
    const prefix = "Bearer ";

    if (!expectedSecret || !authorization.startsWith(prefix)) {
        return res.status(401).json({ message: "No autorizado" });
    }

    const receivedSecret = authorization.slice(prefix.length);
    const expectedBuffer = Buffer.from(expectedSecret, "utf8");
    const receivedBuffer = Buffer.from(receivedSecret, "utf8");

    const valid = expectedBuffer.length === receivedBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!valid) {
        return res.status(401).json({ message: "No autorizado" });
    }

    return next();
}

module.exports = { internalApiAuth };
