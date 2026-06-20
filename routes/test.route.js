const express = require('express');
const {
    listTests,
    listAllTests,
    createTest,
    getTest,
    updateTest,
    deleteTest,
    assignTest,
    unassignTest,
    reorderOfferTests,
    generateAiQuestions,
} = require('../controllers/test.controller');
const {
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
} = require('../controllers/question.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

const managers = authorize(ROLES.ADMIN, ROLES.HR);

// --- Test library (all standalone tests) ---
router.get('/', protect, managers, listAllTests);
router.post('/', protect, managers, createTest);

// --- Tests scoped to an offer (must come before /:testId) ---
router.get('/offer/:offerId', protect, managers, listTests);
router.put('/offer/:offerId/reorder', protect, managers, reorderOfferTests);

// --- Single test ---
router.get('/:testId', protect, managers, getTest);
router.put('/:testId', protect, managers, updateTest);
router.delete('/:testId', protect, managers, deleteTest);

// --- Assign / unassign ---
router.post('/:testId/assign', protect, managers, assignTest);
router.delete('/:testId/assign/:offerId', protect, managers, unassignTest);

// --- AI question generation ---
router.post('/:testId/generate-ai', protect, managers, generateAiQuestions);

// --- Questions on a test ---
router.post('/:testId/question', protect, managers, createQuestion);
router.put('/:testId/question/reorder', protect, managers, reorderQuestions);
router.put('/:testId/question/:questionId', protect, managers, updateQuestion);
router.delete('/:testId/question/:questionId', protect, managers, deleteQuestion);

module.exports = router;
