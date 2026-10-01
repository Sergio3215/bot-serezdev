const crypto = require("node:crypto");

const UNAUTHORIZED_RESPONSE = Object.freeze({ message: "No autorizado" });

function assertInternalApiSecretConfigured() {
    const secret = process.env.INTERNAL_API_SECRET;

    if (typeof secret !== "string" || secret.trim().length === 0) {
        throw new Error("INTERNAL_API_SECRET es obligatorio para iniciar la API");
    }
}

function readBearerToken(req) {
    const authorization = req.get("authorization");

    if (typeof authorization !== "string") {
        return null;
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    return match?.[1] ?? null;
}

function secureDigest(value) {
    return crypto.createHash("sha256").update(value, "utf8").digest();
}

function internalApiAuth(req, res, next) {
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    const receivedSecret = readBearerToken(req);

    if (
        typeof expectedSecret !== "string"
        || expectedSecret.trim().length === 0
        || receivedSecret === null
    ) {
        return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }

    const valid = crypto.timingSafeEqual(
        secureDigest(expectedSecret),
        secureDigest(receivedSecret),
    );

    if (!valid) {
        return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }

    return next();
}

module.exports = {
    assertInternalApiSecretConfigured,
    internalApiAuth,
};
