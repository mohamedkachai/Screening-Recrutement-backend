const express = require('express');
const {
    createOffer,
    listOffers,
    listPublicOffers,
    getOffer,
    updateOffer,
    deleteOffer,
} = require('../controllers/offer.controller');
const {
    applyToOffer,
    listOfferApplications,
    listMyApplications,
    updateApplicationStatus,
} = require('../controllers/application.controller');
const { protect, optionalProtect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

// --- Public (no auth required, but use token if present to show hidden offers) ---
router.get('/public', optionalProtect, listPublicOffers);

// --- Candidate self-service (must be before /:id to avoid clash? No, distinct paths) ---
router.get('/my/applications', protect, authorize(ROLES.CANDIDATE), listMyApplications);

// --- HR/Admin management ---
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.HR), createOffer);
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.HR), listOffers);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.HR), updateOffer);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.HR), deleteOffer);

// --- Authenticated read of a single offer (any role) ---
router.get('/:id', protect, getOffer);

// --- Applications ---
router.post('/:id/apply', protect, authorize(ROLES.CANDIDATE), applyToOffer);
router.get('/:id/applications', protect, authorize(ROLES.ADMIN, ROLES.HR), listOfferApplications);

module.exports = router;
