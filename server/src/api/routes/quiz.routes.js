const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable merging params like :courseId
const quizController = require('../controllers/quiz.controller');
const checkAuth = require('../middleware/checkAuth'); // Adjust path
// const checkRole = require('../middleware/checkRole'); // We are NOT using checkRole for now

// POST /api/courses/:courseId/quizzes - Create a new quiz
router.post(
    '/', // Path relative to mount point
    checkAuth, // Only requires user to be logged in
    // Removed checkRole(['admin', 'faculty']),
    quizController.createQuiz
);

// GET /api/quizzes/:quizId - Get quiz details and its questions
router.get(
    '/:quizId', // Path includes the quizId parameter
    checkAuth,  // Ensure user is logged in
    quizController.getQuizWithQuestions 
);

// POST /api/quizzes/:quizId/questions - Add a question to a quiz
router.post(
    '/:quizId/questions', // Nested under the specific quiz ID
    checkAuth,
    // Add checkRole(['admin', 'faculty']) here later if needed
    quizController.addQuestionToQuiz
);

// POST /api/quizzes/:quizId/submit - Submit answers for a quiz attempt
router.post(
    '/:quizId/submit', // Nested under the specific quiz ID
    checkAuth,
    quizController.submitQuiz
);

// GET /api/courses/:courseId/quizzes - List all quizzes for a course
router.get(
    '/', 
    checkAuth, 
    quizController.listQuizzesForCourse
);

// --- Add GET /:quizId route here later ---
// router.get('/:quizId', checkAuth, quizController.getQuizWithQuestions);

module.exports = router;