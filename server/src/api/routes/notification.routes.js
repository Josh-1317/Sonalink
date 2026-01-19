const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const checkAuth = require('../middleware/checkAuth');

// PUT /api/notifications/:id/read - Mark single notification as read
router.put(
    '/:notificationId/read', 
    checkAuth, 
    notificationController.markAsRead
);

module.exports = router;