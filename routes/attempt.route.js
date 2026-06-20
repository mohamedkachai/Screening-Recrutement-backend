const express = require('express');
const {
    getMyAttempt,
    startAttempt,
    saveAnswer,
    recordEvent,
    submitAttempt,
    listAttemptsByOffer,
    listAllAttempts,
    getAttemptDetail,
    gradeAttempt,
} = require('../controllers/attempt.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

const candidateOnly = authorize(ROLES.CANDIDATE);
const staff = authorize(ROLES.ADMIN, ROLES.HR, ROLES.REVIEWER);

// Candidate
router.get('/offer/:offerId/me', protect, candidateOnly, getMyAttempt);
router.post('/offer/:offerId/start', protect, candidateOnly, startAttempt);
router.post('/:attemptId/answer', protect, candidateOnly, saveAnswer);
router.post('/:attemptId/event', protect, candidateOnly, recordEvent);
router.post('/:attemptId/submit', protect, candidateOnly, submitAttempt);

// HR / Reviewer / Admin
router.get('/', protect, staff, listAllAttempts);
router.get('/offer/:offerId', protect, staff, listAttemptsByOffer);
router.get('/:attemptId', protect, staff, getAttemptDetail);
router.post('/:attemptId/grade', protect, staff, gradeAttempt);

module.exports = router;
