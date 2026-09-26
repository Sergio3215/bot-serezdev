/**
 * Calcula el plan efectivo sin consultar servicios externos ni modificar datos.
 * Acepta tanto una relacion de Prisma ({ code }) como el shape aplanado de la API.
 *
 * @param {object|null|undefined} subscription
 * @param {Date} [now]
 * @returns {string}
 */
function resolveEffectivePlan(subscription, now = new Date()) {
    if (!subscription) return "free";

    const status = typeof subscription.status === "string"
        ? subscription.status
        : subscription.status && subscription.status.code;

    if (status !== "active") return "free";

    if (subscription.currentPeriodEnd !== null
        && subscription.currentPeriodEnd !== undefined) {
        const periodEnd = subscription.currentPeriodEnd instanceof Date
            ? subscription.currentPeriodEnd
            : new Date(subscription.currentPeriodEnd);

        if (Number.isNaN(periodEnd.getTime()) || periodEnd.getTime() <= now.getTime()) {
            return "free";
        }
    }

    const tier = typeof subscription.tier === "string"
        ? subscription.tier
        : subscription.tier && subscription.tier.code;

    return tier || "free";
}

module.exports = { resolveEffectivePlan };
