const pool = require('../models/db'); // Adjust path if needed
const AppError = require('./appError'); // Adjust path if needed

// @route   GET /api/submissions/:submissionId
// @desc    Get results for a specific quiz submission
// @access  Private (Only the user who submitted or maybe faculty/admin)
exports.getSubmissionResult = async (req, res, next) => {
    const { submissionId } = req.params;
    const { userId } = req.userData; // ID of the user requesting

    try {
        // Query 1: Get submission details, including user ID and quiz info
        const submissionQuery = `
            SELECT 
                qs.id, qs.quiz_id, qs.user_id, qs.score, qs.max_possible_score, 
                qs.submitted_at, q.title as quiz_title
            FROM quiz_submissions qs
            JOIN quizzes q ON qs.quiz_id = q.id
            WHERE qs.id = $1;
        `;
        const submissionResult = await pool.query(submissionQuery, [submissionId]);

        if (submissionResult.rows.length === 0) {
            return next(new AppError('Submission not found.', 404));
        }
        const submission = submissionResult.rows[0];

        // --- Authorization ---
        // Ensure the user requesting is the one who made the submission
        // (Add logic here later to allow faculty/admin access if needed)
        if (submission.user_id !== userId) {
            return next(new AppError('Forbidden: You can only view your own submissions.', 403));
        }

        // Query 2: Get the submitted answers for this submission
        // This includes the question text, the user's answer, and whether it was correct
        const answersQuery = `
            SELECT 
                sa.id as answer_id, sa.question_id, sa.selected_option_ids, sa.answer_text, 
                sa.is_correct, sa.points_awarded,
                qq.question_text, qq.question_type
                -- Optionally fetch correct options here if you want to show them
                -- , (SELECT json_agg(qo.id) FROM question_options qo WHERE qo.question_id = sa.question_id AND qo.is_correct = true) as correct_option_ids
            FROM submission_answers sa
            JOIN quiz_questions qq ON sa.question_id = qq.id
            WHERE sa.submission_id = $1
            ORDER BY qq.order_index; -- Show answers in question order
        `;
        const answersResult = await pool.query(answersQuery, [submissionId]);
        const answers = answersResult.rows;

        // Combine submission details and answers
        res.status(200).json({
            submission: submission,
            answers: answers 
            // Note: You might only want to send answers after a due date, 
            // or only send score initially depending on requirements.
        });

    } catch (error) {
        console.error('Get Submission Error:', error);
        next(new AppError('Internal server error fetching submission results.', 500));
    }
};