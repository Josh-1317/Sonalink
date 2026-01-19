const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/checkAuth');
const usersController = require('../controllers/users.controller');
const fileUpload = require('../middleware/file-upload');
const notificationController = require('../controllers/notification.controller');

// GET /api/users/me
// Gets the profile of the currently logged-in user
router.get('/me', checkAuth, usersController.getMe);

// PUT /api/users/profile
// Updates the logged-in user's profile (name, bio)
router.put('/profile', checkAuth, usersController.updateUserProfile);

// PUT /api/users/profile/avatar
// Updates the logged-in user's avatar
// The middleware chain is: checkAuth -> multerUpload -> uploadToCloudinary -> controller
router.put(
    '/profile/avatar',
    checkAuth,
    fileUpload.avatarMulterUpload, // Corrected from multerUpload
    fileUpload.uploadAvatarToCloudinary, // Corrected from uploadToCloudinary
    usersController.updateUserAvatar);

// GET /api/users/me/courses
// Gets all courses the logged-in user is enrolled in
router.get('/me/courses', checkAuth, usersController.getEnrolledCourses);

// GET /api/users/:
// GET /api/users/me/contributions
router.get('/me/contributions', checkAuth, usersController.getUserContributions);

// Gets the public profile of any user
router.get('/:id', usersController.getUserProfile);

// GET /api/users/me/notifications - Get all notifications
router.get('/me/notifications', checkAuth, notificationController.getNotifications);

// GET /api/users/me/enrolled-courses (Fetches courses for the logged-in user)
router.get('/me/enrolled-courses', checkAuth, usersController.getEnrolledCourses);

module.exports = router;