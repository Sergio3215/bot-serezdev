const express = require("express");
const {
    getScheduledTasks,
    createScheduledTask,
    updateScheduledTask,
    updateScheduledTaskStatus,
    deleteScheduledTask,
} = require("./scheduledTask.controller.js");

const router = express.Router();

router.get("/", getScheduledTasks);
router.post("/", createScheduledTask);
router.put("/:id", updateScheduledTask);
router.patch("/:id/status", updateScheduledTaskStatus);
router.delete("/:id", deleteScheduledTask);

module.exports = router;
