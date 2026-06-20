const express = require('express');
const {signUp, login, getMe, changePassword, forgotPassword, resetPassword} = require('../controllers/auth.controller');
const {protect} = require('../middlewares/auth.middleware')

const router = express.Router();

router.post('/signup', signUp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;