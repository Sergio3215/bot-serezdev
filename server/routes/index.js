const express = require("express");
const router = express.Router();

const gifRoutes = require("./gif");
const birthdaySetRoutes = require("./birthdaySet");

// 1. Compatibilidad directa para el frontend actual (/api/v1/getInteractions, /api/v1/addGif, etc.)
router.use("/", gifRoutes);

// 2. Rutas con prefijo molecular (/api/v1/gif/getInteractions, etc.)
router.use("/gif", gifRoutes);

// Rutas de cumpleaños y configuración (/api/v1/birthdaySet/... o /api/v1/birthday/...)
router.use("/birthday", birthdaySetRoutes);

module.exports = router;
