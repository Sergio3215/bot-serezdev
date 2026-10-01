const express = require("express");
const {
    getSubscription,
    saveSubscription,
} = require("./subscriptions.controller");

const router = express.Router();

router.get("/", getSubscription);
router.post("/", saveSubscription);

module.exports = router;
