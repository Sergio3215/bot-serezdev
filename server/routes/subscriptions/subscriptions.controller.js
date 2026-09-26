const { prisma: defaultPrisma } = require("../../../db/index");

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CODE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const MAX_REFERENCE_LENGTH = 255;

class PaymentReferenceConflict extends Error {}

function flattenSubscription(subscription) {
    return {
        serverId: subscription.serverId,
        tier: subscription.tier.code,
        status: subscription.status.code,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
    };
}

function parseOptionalDate(body, field) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
        return { present: false };
    }

    const value = body[field];
    if (value === null) return { present: true, value: null };

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return { error: `${field} debe ser una fecha ISO o null` };
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return { error: `${field} debe ser una fecha ISO o null` };
    }

    return { present: true, value: parsed };
}

function validatePayment(payment) {
    if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
        return { error: "payment debe ser un objeto" };
    }

    if (typeof payment.provider !== "string" || !CODE_PATTERN.test(payment.provider)) {
        return { error: "payment.provider es invalido" };
    }

    if (typeof payment.reference !== "string"
        || payment.reference.trim().length === 0
        || payment.reference.length > MAX_REFERENCE_LENGTH) {
        return { error: "payment.reference es requerido" };
    }

    if (payment.payerUserId !== undefined
        && payment.payerUserId !== null
        && (typeof payment.payerUserId !== "string"
            || !SNOWFLAKE_PATTERN.test(payment.payerUserId))) {
        return { error: "payment.payerUserId debe ser un snowflake de Discord o null" };
    }

    if (payment.amount !== undefined
        && payment.amount !== null
        && (typeof payment.amount !== "number"
            || !Number.isFinite(payment.amount)
            || payment.amount < 0)) {
        return { error: "payment.amount debe ser un numero no negativo" };
    }

    if (payment.currency !== undefined
        && payment.currency !== null
        && (typeof payment.currency !== "string"
            || !/^[a-zA-Z]{3}$/.test(payment.currency))) {
        return { error: "payment.currency debe ser un codigo de tres letras" };
    }

    return {
        value: {
            provider: payment.provider,
            reference: payment.reference.trim(),
            payerUserId: payment.payerUserId ?? null,
            amount: payment.amount ?? null,
            currency: payment.currency ? payment.currency.toLowerCase() : null,
        }
    };
}

function validatePostBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "El body debe ser un objeto" };
    }

    if (typeof body.serverId !== "string" || !SNOWFLAKE_PATTERN.test(body.serverId)) {
        return { error: "serverId debe ser un snowflake de Discord valido" };
    }

    if (typeof body.tier !== "string" || !CODE_PATTERN.test(body.tier)) {
        return { error: "tier es requerido" };
    }

    if (typeof body.status !== "string" || !CODE_PATTERN.test(body.status)) {
        return { error: "status es requerido" };
    }

    const currentPeriodStart = parseOptionalDate(body, "currentPeriodStart");
    if (currentPeriodStart.error) return currentPeriodStart;

    const currentPeriodEnd = parseOptionalDate(body, "currentPeriodEnd");
    if (currentPeriodEnd.error) return currentPeriodEnd;

    let payment;
    if (body.payment !== undefined) {
        const result = validatePayment(body.payment);
        if (result.error) return result;
        payment = result.value;
    }

    return {
        value: {
            serverId: body.serverId,
            tier: body.tier,
            status: body.status,
            currentPeriodStart,
            currentPeriodEnd,
            payment,
        }
    };
}

function createSubscriptionsController(prisma = defaultPrisma) {
    const getSubscription = async (req, res) => {
        const { serverId } = req.query;

        if (typeof serverId !== "string" || !SNOWFLAKE_PATTERN.test(serverId)) {
            return res.status(400).json({
                message: "serverId debe ser un snowflake de Discord valido"
            });
        }

        try {
            const subscription = await prisma.subscription.findUnique({
                where: { serverId },
                include: {
                    tier: { select: { code: true } },
                    status: { select: { code: true } },
                }
            });

            return res.status(200).json({
                data: subscription ? [flattenSubscription(subscription)] : []
            });
        } catch (error) {
            console.error("No se pudo leer la suscripcion", error);
            return res.status(500).json({ message: "No se pudo leer la suscripcion" });
        }
    };

    const saveSubscription = async (req, res) => {
        const validation = validatePostBody(req.body);
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        const input = validation.value;

        try {
            const lookups = [
                prisma.tier.findUnique({ where: { code: input.tier }, select: { id: true } }),
                prisma.subscriptionStatus.findUnique({
                    where: { code: input.status },
                    select: { id: true }
                }),
            ];

            if (input.payment) {
                lookups.push(prisma.paymentProvider.findUnique({
                    where: { code: input.payment.provider },
                    select: { id: true }
                }));
            }

            const [tier, status, provider] = await Promise.all(lookups);

            if (!tier) {
                return res.status(400).json({ message: `Tier desconocido: ${input.tier}` });
            }

            if (!status) {
                return res.status(400).json({ message: `Estado desconocido: ${input.status}` });
            }

            if (input.payment && !provider) {
                return res.status(400).json({
                    message: `Proveedor desconocido: ${input.payment.provider}`
                });
            }

            const periodData = {};
            if (input.currentPeriodStart.present) {
                periodData.currentPeriodStart = input.currentPeriodStart.value;
            }
            if (input.currentPeriodEnd.present) {
                periodData.currentPeriodEnd = input.currentPeriodEnd.value;
            }

            const subscription = await prisma.$transaction(async (transaction) => {
                if (input.payment) {
                    const existingPayment = await transaction.payment.findUnique({
                        where: { reference: input.payment.reference },
                        select: {
                            subscription: { select: { serverId: true } }
                        }
                    });

                    if (existingPayment
                        && existingPayment.subscription.serverId !== input.serverId) {
                        throw new PaymentReferenceConflict();
                    }
                }

                const savedSubscription = await transaction.subscription.upsert({
                    where: { serverId: input.serverId },
                    create: {
                        serverId: input.serverId,
                        tierId: tier.id,
                        statusId: status.id,
                        currentPeriodStart: input.currentPeriodStart.present
                            ? input.currentPeriodStart.value
                            : null,
                        currentPeriodEnd: input.currentPeriodEnd.present
                            ? input.currentPeriodEnd.value
                            : null,
                    },
                    update: {
                        tierId: tier.id,
                        statusId: status.id,
                        ...periodData,
                    },
                    include: {
                        tier: { select: { code: true } },
                        status: { select: { code: true } },
                    }
                });

                if (input.payment) {
                    const payment = input.payment;
                    await transaction.payment.upsert({
                        where: { reference: payment.reference },
                        create: {
                            subscriptionId: savedSubscription.id,
                            providerId: provider.id,
                            reference: payment.reference,
                            payerUserId: payment.payerUserId,
                            amount: payment.amount,
                            currency: payment.currency,
                        },
                        // Un reintento nunca reescribe ni mueve un cobro ya registrado.
                        update: { reference: payment.reference },
                    });
                }

                return savedSubscription;
            });

            return res.status(200).json({ data: flattenSubscription(subscription) });
        } catch (error) {
            if (error instanceof PaymentReferenceConflict) {
                return res.status(409).json({
                    message: "La referencia de pago ya pertenece a otro servidor"
                });
            }

            console.error("No se pudo guardar la suscripcion", error);
            return res.status(500).json({ message: "No se pudo guardar la suscripcion" });
        }
    };

    return { getSubscription, saveSubscription };
}

const controller = createSubscriptionsController();

module.exports = {
    ...controller,
    createSubscriptionsController,
    flattenSubscription,
    validatePostBody,
};
