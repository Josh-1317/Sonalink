const pool = require('../models/db'); // Adjust path if needed
const AppError = require('./appError'); // Adjust path if needed

// @route   GET /api/users/me/notifications
// @desc    Get the authenticated user's notifications
// @access  Private (Authenticated users only)
exports.getNotifications = async (req, res, next) => {
    const { userId } = req.userData; // From checkAuth middleware
    const { limit = 10, offset = 0 } = req.query;

    try {
        // Query to fetch all notifications for the user
        const notificationsQuery = `
            SELECT 
                id, type, message, is_read, related_resource_id, 
                related_resource_type, created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3;
        `;
        const notificationsResult = await pool.query(notificationsQuery, [userId, limit, offset]);

        // Query to get the total count (for frontend pagination)
        const countQuery = `SELECT COUNT(id) FROM notifications WHERE user_id = $1`;
        const countResult = await pool.query(countQuery, [userId]);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalUnread = await pool.query('SELECT COUNT(id) FROM notifications WHERE user_id = $1 AND is_read = false', [userId]);

        res.status(200).json({
            notifications: notificationsResult.rows,
            pagination: {
                totalItems: totalItems,
                totalUnread: parseInt(totalUnread.rows[0].count, 10)
            }
        });

    } catch (error) {
        console.error('Get Notifications Error:', error);
        next(new AppError('Internal server error fetching notifications.', 500));
    }
};

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private (Only the owner of the notification)
exports.markAsRead = async (req, res, next) => {
    const { notificationId } = req.params;
    const { userId } = req.userData;

    try {
        const updateQuery = `
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = $1 AND user_id = $2 -- Must belong to the user
            RETURNING id, is_read;
        `;
        const result = await pool.query(updateQuery, [notificationId, userId]);

        if (result.rows.length === 0) {
             return next(new AppError('Notification not found or access denied.', 404));
        }

        res.status(200).json({
            message: 'Notification marked as read.',
            notification: result.rows[0]
        });

    } catch (error) {
        console.error('Mark As Read Error:', error);
        next(new AppError('Internal server error updating notification status.', 500));
    }
};