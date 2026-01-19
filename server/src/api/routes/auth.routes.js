const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// POST /auth/signup
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/verify/:token', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;