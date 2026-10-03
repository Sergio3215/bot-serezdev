const express = require("express");
const {
    getChannelRules,
    createChannelRule,
    updateChannelRule,
    updateChannelRuleEnabled,
    deleteChannelRule,
} = require("./channelRule.controller");

const router = express.Router();

router.get("/", getChannelRules);
router.post("/", createChannelRule);
router.put("/:id", updateChannelRule);
router.patch("/:id/enabled", updateChannelRuleEnabled);
router.delete("/:id", deleteChannelRule);

module.exports = router;
