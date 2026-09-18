const express = require("express");
const router = express.Router();
const birthdaySetController = require("./birthdaySet.controller");

router.get("/setup", birthdaySetController.getSetup);
router.put("/setup", birthdaySetController.saveSetup);

module.exports = router;
