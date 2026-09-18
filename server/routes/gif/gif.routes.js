const express = require("express");
const router = express.Router();
const gifController = require("./gif.controller");

router.post("/syncGif", gifController.syncGif);
router.get("/getInteractions", gifController.getInteractions);
router.get("/getInteractionByName", gifController.getInteractionByName);
router.post("/addGif", gifController.addGif);
router.put("/editGif", gifController.editGif);
router.delete("/deleteGif", gifController.deleteGif);

module.exports = router;
