const express = require('express');
const {
    exportAttemptPdf,
    exportOfferRecapPdf,
} = require('../controllers/export.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

const staff = authorize(ROLES.ADMIN, ROLES.HR, ROLES.REVIEWER);

router.get('/attempt/:attemptId/pdf', protect, staff, exportAttemptPdf);
router.get('/offer/:offerId/recap.pdf', protect, staff, exportOfferRecapPdf);

module.exports = router;
