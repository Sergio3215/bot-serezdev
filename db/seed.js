const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TIERS = [
    { code: "free", name: "Free" },
    { code: "pro", name: "Pro" },
    { code: "premium", name: "Premium" },
];

const SUBSCRIPTION_STATUSES = [
    { code: "active", name: "Active" },
    { code: "pending", name: "Pending" },
    { code: "canceled", name: "Canceled" },
    { code: "expired", name: "Expired" },
];

const PAYMENT_PROVIDERS = [
    { code: "stripe", name: "Stripe" },
    { code: "mercadopago", name: "Mercado Pago" },
];

async function upsertCatalog(delegate, entries) {
    await Promise.all(entries.map((entry) => delegate.upsert({
        where: { code: entry.code },
        create: entry,
        update: { name: entry.name },
    })));
}

async function seedCatalogs(client) {
    await upsertCatalog(client.tier, TIERS);
    await upsertCatalog(client.subscriptionStatus, SUBSCRIPTION_STATUSES);
    await upsertCatalog(client.paymentProvider, PAYMENT_PROVIDERS);
}

if (require.main === module) {
    seedCatalogs(prisma)
        .then(() => console.log("Catalogos de suscripciones inicializados"))
        .catch((error) => {
            console.error("No se pudieron inicializar los catalogos", error);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

module.exports = {
    seedCatalogs,
    TIERS,
    SUBSCRIPTION_STATUSES,
    PAYMENT_PROVIDERS,
};
