const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const { getLogs, getLogsByActorId } = require("../controllers/log.controller");

const router = express.Router();

router.get("/", protect, getLogs);
router.get('/:id', protect, getLogsByActorId);

module.exports = router;