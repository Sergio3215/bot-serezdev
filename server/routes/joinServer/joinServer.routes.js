const express = require("express");
const router = express.Router();
const { getJoinServer, createJoinServer, updateJoinServer } = require("./joinServer.controller");

router.get("/setup", getJoinServer);
router.post("/setup", createJoinServer);
router.put("/setup", updateJoinServer);

module.exports = router;
