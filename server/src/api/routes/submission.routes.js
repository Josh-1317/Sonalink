const express = require('express');
const router = express.Router(); 
const submissionController = require('../controllers/submission.controller');
const checkAuth = require('../middleware/checkAuth'); // Adjust path

// GET /api/submissions/:submissionId - Get results for a submission
router.get(
    '/:submissionId', 
    checkAuth, 
    submissionController.getSubmissionResult
);

// Add other submission-related routes here later if needed

module.exports = router;