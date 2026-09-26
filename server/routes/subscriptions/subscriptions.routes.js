const express = require("express");
const { internalApiAuth } = require("../../middleware/internalApiAuth");
const {
    getSubscription,
    saveSubscription,
} = require("./subscriptions.controller");

const router = express.Router();

router.use(internalApiAuth);
router.get("/", getSubscription);
router.post("/", saveSubscription);

module.exports = router;
