const express = require("express");
const {
    getCustomCommands,
    createCustomCommand,
    updateCustomCommand,
    updateCustomCommandStatus,
    deleteCustomCommand,
} = require("./customCommand.controller");

const router = express.Router();

router.get("/", getCustomCommands);
router.post("/", createCustomCommand);
router.put("/:id", updateCustomCommand);
router.patch("/:id/status", updateCustomCommandStatus);
router.delete("/:id", deleteCustomCommand);

module.exports = router;
