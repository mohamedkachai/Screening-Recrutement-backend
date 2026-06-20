const express = require('express');
const { updateApplicationStatus } = require('../controllers/application.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

router.patch('/:id/status', protect, authorize(ROLES.ADMIN, ROLES.HR), updateApplicationStatus);

module.exports = router;
