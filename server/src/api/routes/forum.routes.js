const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable merging params like :courseId
const forumController = require('../controllers/forum.controller');
const checkAuth = require('../middleware/checkAuth'); // Adjust path if needed

// POST /api/courses/:courseId/forum - Create a new thread
router.post(
    '/', // The path is relative to where it's mounted in app.js
    checkAuth, // Ensure user is logged in
    forumController.createThread
);

// GET /api/courses/:courseId/forum - List threads for a course
router.get(
    '/', // Path relative to the mount point
    checkAuth, // Ensure user is logged in to view forum
    forumController.listThreadsForCourse
);

// POST /api/forum/threads/:threadId/replies - Add a reply to a thread
router.post(
    '/threads/:threadId/replies', // Define the path including threadId
    checkAuth,
    forumController.createReply
);

// GET /api/forum/threads/:threadId - Get a single thread with replies
router.get(
    '/threads/:threadId', // Path includes the threadId parameter
    checkAuth,
    forumController.getThreadWithReplies
);

// PUT /api/forum/replies/:replyId/accept - Mark a reply as the accepted answer
router.put(
    '/replies/:replyId/accept', // Path includes the replyId parameter
    checkAuth,
    forumController.acceptAnswer
);

// GET /api/forum/threads - Get forum threads globally (can be sorted)
router.get('/threads', checkAuth, forumController.getAllThreads);

module.exports = router;