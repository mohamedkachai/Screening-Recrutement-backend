const express = require('express');
const {
    createInvitation,
    createBatchInvitations,
    listInvitations,
    revokeInvitation,
    getInvitationByToken,
    acceptInvitation,
} = require('../controllers/invitation.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

// Public — token-based
router.get('/:token', getInvitationByToken);
router.post('/:token/accept', acceptInvitation);

// HR/Admin
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.HR), createInvitation);
router.post('/batch', protect, authorize(ROLES.ADMIN, ROLES.HR), createBatchInvitations);
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.HR), listInvitations);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.HR), revokeInvitation);

module.exports = router;
