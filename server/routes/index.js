const express = require("express");
const router = express.Router();

const gifRoutes = require("./gif");
const birthdaySetRoutes = require("./birthdaySet");

const joinServerRoutes = require("./joinServer");
const subscriptionRoutes = require("./subscriptions");
const customCommandRoutes = require("./customCommand");
const channelRuleRoutes = require("./channelRule");
const scheduledTaskRoutes = require("./scheduledTask");

// Gifs sin prefijo (/api/v1/getInteractions, ...) por compatibilidad; el panel usa /api/v1/gif/...
router.use("/", gifRoutes);
router.use("/gif", gifRoutes);

// Saludo y tarjeta de cumpleaños (/api/v1/birthday/...)
router.use("/birthday", birthdaySetRoutes);

// Bienvenida: rol al entrar y tarjeta (/api/v1/joinServer/...)
router.use("/joinServer", joinServerRoutes);

// Estado de suscripción que el panel persiste y consulta; las reglas del plan viven en el panel.
router.use("/subscriptions", subscriptionRoutes);

// Creación y administración de comandos personalizados por servidor.
router.use("/customCommand", customCommandRoutes);

// Reglas configurables aplicadas por canal en el runtime del bot.
router.use("/channelRule", channelRuleRoutes);

// Mensajes recurrentes configurables por servidor.
router.use("/scheduledTask", scheduledTaskRoutes);

module.exports = router;
