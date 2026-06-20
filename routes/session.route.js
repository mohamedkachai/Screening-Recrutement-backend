const express = require('express');
const {
    getSessionByOffer,
    upsertSession,
    updateSession,
    deleteSession,
} = require('../controllers/session.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

const managers = authorize(ROLES.ADMIN, ROLES.HR);

// Session is keyed by offer (one per offer)
router.get('/offer/:offerId', protect, getSessionByOffer);
router.post('/offer/:offerId', protect, managers, upsertSession);
router.put('/:sessionId', protect, managers, updateSession);
router.delete('/:sessionId', protect, managers, deleteSession);

module.exports = router;
