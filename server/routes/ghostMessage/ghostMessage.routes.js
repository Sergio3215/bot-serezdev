const express = require("express");
const controller = require("./ghostMessage.controller.js");

const router = express.Router();
router.get("/", controller.getAll);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.updateStatus);
router.delete("/:id", controller.remove);

module.exports = router;
