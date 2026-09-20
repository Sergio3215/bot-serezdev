const express = require("express");
const router = express.Router();
const { getJoinServer, createJoinServer, updateJoinServer } = require("./joinServer.controller");
const { getWelcomeCard, createWelcomeCard, updateWelcomeCard } = require("./welcomeCard.controller");

// Rol que se asigna solo al entrar
router.get("/setup", getJoinServer);
router.post("/setup", createJoinServer);
router.put("/setup", updateJoinServer);

// Imagen de bienvenida que publica el bot al entrar
router.get("/setup-card", getWelcomeCard);
router.post("/setup-card", createWelcomeCard);
router.put("/setup-card", updateWelcomeCard);

module.exports = router;
