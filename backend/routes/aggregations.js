const express = require("express");
const router = express.Router();
const { getAggregations } = require("../controllers/aggregationsController");

router.get("/", getAggregations);

module.exports = router;
