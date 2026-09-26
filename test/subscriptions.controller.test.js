const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createSubscriptionsController,
    validatePostBody,
} = require("../server/routes/subscriptions/subscriptions.controller");

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

function createFakePrisma() {
    const subscriptions = new Map();
    const payments = new Map();
    let nextId = 1;

    const prisma = {
        subscriptions,
        payments,
        $transaction: async (operation) => operation(prisma),
        tier: {
            findUnique: async ({ where }) => ["free", "pro", "premium"].includes(where.code)
                ? { id: `tier-${where.code}` }
                : null,
        },
        subscriptionStatus: {
            findUnique: async ({ where }) => ["active", "pending", "canceled", "expired"]
                .includes(where.code)
                ? { id: `status-${where.code}` }
                : null,
        },
        paymentProvider: {
            findUnique: async ({ where }) => ["stripe", "mercadopago"].includes(where.code)
                ? { id: `provider-${where.code}` }
                : null,
        },
        subscription: {
            findUnique: async ({ where }) => subscriptions.get(where.serverId) || null,
            upsert: async ({ where, create, update }) => {
                const current = subscriptions.get(where.serverId);
                const values = current ? { ...current, ...update } : {
                    id: `subscription-${nextId++}`,
                    ...create,
                };
                values.tier = { code: values.tierId.replace("tier-", "") };
                values.status = { code: values.statusId.replace("status-", "") };
                subscriptions.set(where.serverId, values);
                return values;
            },
        },
        payment: {
            findUnique: async ({ where }) => {
                const payment = payments.get(where.reference);
                if (!payment) return null;

                const subscription = [...subscriptions.values()]
                    .find((entry) => entry.id === payment.subscriptionId);
                return { subscription: { serverId: subscription.serverId } };
            },
            upsert: async ({ where, create }) => {
                if (!payments.has(where.reference)) {
                    payments.set(where.reference, { id: `payment-${nextId++}`, ...create });
                }
                return payments.get(where.reference);
            },
        },
    };

    return prisma;
}

const BODY = {
    serverId: "1312903712238469170",
    tier: "premium",
    status: "active",
    currentPeriodStart: "2026-09-25T12:00:00.000Z",
    currentPeriodEnd: "2026-10-25T12:00:00.000Z",
    payment: {
        provider: "stripe",
        payerUserId: "1312903712238469171",
        amount: 7.99,
        currency: "USD",
        reference: "cs_test_123",
    },
};

test("valida snowflakes y fechas antes de persistir", () => {
    assert.match(validatePostBody({ ...BODY, serverId: "123" }).error, /snowflake/);
    assert.match(validatePostBody({ ...BODY, currentPeriodEnd: "manana" }).error, /fecha ISO/);
});

test("GET devuelve un array vacio cuando no hay suscripcion", async () => {
    const controller = createSubscriptionsController(createFakePrisma());
    const res = response();

    await controller.getSubscription({ query: { serverId: BODY.serverId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: [] });
});

test("POST aplana la respuesta y deduplica el pago por reference", async () => {
    const prisma = createFakePrisma();
    const controller = createSubscriptionsController(prisma);

    const first = response();
    await controller.saveSubscription({ body: BODY }, first);

    const repeated = response();
    await controller.saveSubscription({ body: BODY }, repeated);

    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.body.data, {
        serverId: BODY.serverId,
        tier: "premium",
        status: "active",
        currentPeriodStart: new Date(BODY.currentPeriodStart),
        currentPeriodEnd: new Date(BODY.currentPeriodEnd),
    });
    assert.deepEqual(repeated.body.data, first.body.data);
    assert.equal(prisma.subscriptions.size, 1);
    assert.equal(prisma.payments.size, 1);
});

test("una referencia de pago no se puede acreditar a otro servidor", async () => {
    const prisma = createFakePrisma();
    const controller = createSubscriptionsController(prisma);

    await controller.saveSubscription({ body: BODY }, response());

    const conflict = response();
    await controller.saveSubscription({
        body: { ...BODY, serverId: "1312903712238469172" }
    }, conflict);

    assert.equal(conflict.statusCode, 409);
    assert.equal(prisma.subscriptions.size, 1);
    assert.equal(prisma.payments.size, 1);
});
