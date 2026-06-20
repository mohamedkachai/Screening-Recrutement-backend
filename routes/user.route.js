const express = require('express');
const { createUser, putUser, getUser, deleteUser, listUsers, updateMyProfile } = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { ROLES } = require('../models/enums');

const router = express.Router();

// Self-service profile update (any authenticated user)
router.put('/me/profile', protect, updateMyProfile);

// Admin-only user management
router.post('/create', protect, authorize(ROLES.ADMIN), createUser);
router.put('/update/:id', protect, authorize(ROLES.ADMIN), putUser);
router.delete('/:id', protect, authorize(ROLES.ADMIN), deleteUser);
router.get('/', protect, authorize(ROLES.ADMIN), listUsers);
router.get('/:id', protect, authorize(ROLES.ADMIN), getUser);

module.exports = router;