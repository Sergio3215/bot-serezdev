const express = require("express");
const router = express.Router();
const birthdaySetController = require("./birthdaySet.controller");
const { getBirthdayCard, createBirthdayCard, updateBirthdayCard } = require("./birthdayCard.controller");

// Canal y mensaje del saludo
router.get("/setup", birthdaySetController.getSetup);
router.put("/setup", birthdaySetController.saveSetup);

// Imagen que el bot adjunta a ese saludo
router.get("/setup-card", getBirthdayCard);
router.post("/setup-card", createBirthdayCard);
router.put("/setup-card", updateBirthdayCard);

module.exports = router;
