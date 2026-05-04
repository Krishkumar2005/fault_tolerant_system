const express = require("express");
const router = express.Router();
const { ingestEvent, getProcessedEvents, getFailedEvents } = require("../controllers/eventsController");

router.post("/", ingestEvent);
router.get("/", getProcessedEvents);
router.get("/failed", getFailedEvents);

module.exports = router;
