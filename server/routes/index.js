const express = require("express");
const router = express.Router();

const gifRoutes = require("./gif");
const birthdaySetRoutes = require("./birthdaySet");

const joinServerRoutes = require("./joinServer");
const subscriptionRoutes = require("./subscriptions");

// 1. Compatibilidad directa para el frontend actual (/api/v1/getInteractions, /api/v1/addGif, etc.)
router.use("/", gifRoutes);

// 2. Rutas con prefijo molecular (/api/v1/gif/getInteractions, etc.)
router.use("/gif", gifRoutes);

// Rutas de cumpleaños y configuración (/api/v1/birthdaySet/... o /api/v1/birthday/...)
router.use("/birthday", birthdaySetRoutes);

// Rutas de cumpleaños y configuración (/api/v1/joinServer/... o /api/v1/joinServer/...)
router.use("/joinServer", joinServerRoutes);

// Estado de facturacion que el panel persiste y consulta mediante la API interna.
router.use("/subscriptions", subscriptionRoutes);

module.exports = router;
