const pool = require('../models/db'); // Adjust path if needed
const AppError = require('./appError'); // Adjust path if needed

// @route   POST /api/courses/:courseId/quizzes
// @desc    Create a new quiz in a course
// @access  Private (ANY Authenticated user for now)
exports.createQuiz = async (req, res, next) => {
    const { title, description, time_limit_minutes, due_date } = req.body;
    const { courseId } = req.params;
    const { userId: creatorId } = req.userData; // From checkAuth middleware

    // Basic Validation
    if (!title || title.trim() === '') {
        return next(new AppError('Quiz title cannot be empty.', 400));
    }

    // Optional: Validate time_limit_minutes
    if (time_limit_minutes !== undefined && (!Number.isInteger(time_limit_minutes) || time_limit_minutes <= 0)) {
        return next(new AppError('Time limit must be a positive integer.', 400));
    }

    // Optional: Validate due_date
    let validDueDate = null;
    if (due_date) {
        validDueDate = new Date(due_date);
        if (isNaN(validDueDate.getTime())) {
            return next(new AppError('Invalid due date format.', 400));
        }
    }

    try {
        const query = `
            INSERT INTO quizzes (title, description, course_id, creator_id, time_limit_minutes, due_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *; -- Return the newly created quiz
        `;
        const values = [title, description, courseId, creatorId, time_limit_minutes, validDueDate];

        const result = await pool.query(query, values);
        const newQuiz = result.rows[0];

        res.status(201).json({
            message: 'Quiz created successfully.',
            quiz: newQuiz
        });

    } catch (error) {
        if (error.code === '23503') { // foreign_key_violation
             return next(new AppError('Invalid course ID.', 400));
        }
        console.error('Create Quiz Error:', error);
        next(new AppError('Internal server error creating quiz.', 500));
    }
};

exports.getQuizWithQuestions = async (req, res, next) => {
    const { quizId } = req.params;

    try {
        // Query 1: Get Quiz Details
        const quizQuery = `
            SELECT 
                q.id, q.title, q.description, q.course_id, q.time_limit_minutes, q.due_date,
                c.name as course_name 
            FROM quizzes q
            JOIN courses c ON q.course_id = c.id
            WHERE q.id = $1;
        `;
        const quizResult = await pool.query(quizQuery, [quizId]);

        if (quizResult.rows.length === 0) {
            return next(new AppError('Quiz not found.', 404));
        }
        const quiz = quizResult.rows[0];

        // Query 2: Get Questions (without answers/correct status)
        const questionsQuery = `
            SELECT 
                qq.id, qq.question_text, qq.question_type, qq.points, qq.order_index,
                -- Aggregate options for multiple choice questions
                COALESCE(
                    json_agg(
                        json_build_object('id', qo.id, 'option_text', qo.option_text) 
                        ORDER BY qo.id -- Consistent option order
                    ) FILTER (WHERE qo.id IS NOT NULL), 
                    '[]'::json -- Return empty JSON array if no options
                ) as options 
            FROM quiz_questions qq
            LEFT JOIN question_options qo ON qq.id = qo.question_id
            WHERE qq.quiz_id = $1
            GROUP BY qq.id -- Group by question to aggregate options
            ORDER BY qq.order_index; -- Ensure questions are in order
        `;
        const questionsResult = await pool.query(questionsQuery, [quizId]);
        const questions = questionsResult.rows;

        // Combine quiz details and questions
        res.status(200).json({
            quiz: quiz,
            questions: questions
        });

    } catch (error) {
        console.error('Get Quiz/Questions Error:', error);
        next(new AppError('Internal server error fetching quiz details.', 500));
    }
};

exports.addQuestionToQuiz = async (req, res, next) => {
    const { quizId } = req.params;
    const { userId } = req.userData; // User adding the question
    const { question_text, question_type, points, order_index, options } = req.body;
    // 'options' expected structure (for multiple choice):
    // [ { "option_text": "Option A", "is_correct": false }, { "option_text": "Option B", "is_correct": true }, ... ]

    // --- Basic Validation ---
    if (!question_text || !question_type || order_index === undefined || order_index === null) {
        return next(new AppError('Question text, type, and order index are required.', 400));
    }
    const validTypes = ['multiple_choice_single', 'multiple_choice_multiple', 'true_false', 'short_answer'];
    if (!validTypes.includes(question_type)) {
        return next(new AppError(`Invalid question type. Must be one of: ${validTypes.join(', ')}`, 400));
    }
    if (question_type.startsWith('multiple_choice') && (!Array.isArray(options) || options.length === 0)) {
        return next(new AppError('Options array is required for multiple choice questions.', 400));
    }
    // Add more validation for options structure if needed

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- Optional: Authorization ---
        // Check if the quiz exists and if the current user is the creator (or admin/faculty)
        const quizCheck = await client.query('SELECT creator_id FROM quizzes WHERE id = $1', [quizId]);
        if (quizCheck.rows.length === 0) {
             await client.query('ROLLBACK'); client.release();
             return next(new AppError('Quiz not found.', 404));
        }
        // Uncomment this if only creator should add questions:
        // if (quizCheck.rows[0].creator_id !== userId) {
        //     await client.query('ROLLBACK'); client.release();
        //     return next(new AppError('Forbidden: Only the quiz creator can add questions.', 403));
        // }

        // --- Insert the Question ---
        const questionQuery = `
            INSERT INTO quiz_questions (quiz_id, question_text, question_type, points, order_index)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, question_text, question_type, points, order_index;
        `;
        const questionValues = [quizId, question_text, question_type, points || 1, order_index];
        const questionResult = await client.query(questionQuery, questionValues);
        const newQuestion = questionResult.rows[0];

        // --- Insert Options (if applicable) ---
        let insertedOptions = [];
        if (question_type.startsWith('multiple_choice') && options) {
            // Prepare multi-row insert for options
            const optionValues = [];
            const optionParams = [];
            let paramCounter = 1;
            options.forEach(opt => {
                optionParams.push(`($${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
                optionValues.push(newQuestion.id, opt.option_text, opt.is_correct || false);
            });

            const optionsQuery = `
                INSERT INTO question_options (question_id, option_text, is_correct)
                VALUES ${optionParams.join(', ')}
                RETURNING id, option_text, is_correct;
            `;
            const optionsResult = await client.query(optionsQuery, optionValues);
            insertedOptions = optionsResult.rows;
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Question added successfully.',
            question: { ...newQuestion, options: insertedOptions } // Return question with its options
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Add Question Error:', error);
        next(new AppError('Internal server error adding question.', 500));
    } finally {
        client.release();
    }
};

exports.submitQuiz = async (req, res, next) => {
    const { quizId } = req.params;
    const { userId } = req.userData;
    const { answers } = req.body; // Expected format: [ { question_id: 1, selected_option_ids: [2] }, { question_id: 2, answer_text: "Some text" } ]

    // --- Basic Validation ---
    if (!Array.isArray(answers) || answers.length === 0) {
        return next(new AppError('Answers array is required.', 400));
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- Optional: Check if quiz exists and is valid (e.g., within due date if applicable) ---
        const quizCheck = await client.query('SELECT id, time_limit_minutes, due_date FROM quizzes WHERE id = $1', [quizId]);
        if (quizCheck.rows.length === 0) {
             await client.query('ROLLBACK'); client.release();
             return next(new AppError('Quiz not found.', 404));
        }
        const quiz = quizCheck.rows[0];
        // Add logic here to check due_date or if user already submitted if needed

        // --- 1. Create a Submission Record ---
        // We'll calculate score later. Max score needs fetching questions.
        const submissionQuery = `
            INSERT INTO quiz_submissions (quiz_id, user_id, submitted_at) 
            VALUES ($1, $2, NOW()) 
            RETURNING id as submission_id; 
        `;
        const submissionResult = await client.query(submissionQuery, [quizId, userId]);
        const submissionId = submissionResult.rows[0].submission_id;

        // --- 2. Get All Questions and Correct Options for Grading ---
        // Fetch questions and their correct options in one go
        const questionsAndAnswersQuery = `
            SELECT 
                qq.id as question_id, 
                qq.question_type, 
                qq.points,
                COALESCE(
                    json_agg(qo.id) FILTER (WHERE qo.is_correct = true), 
                    '[]'::json
                ) as correct_option_ids 
            FROM quiz_questions qq
            LEFT JOIN question_options qo ON qq.id = qo.question_id
            WHERE qq.quiz_id = $1
            GROUP BY qq.id;
        `;
        const questionsAndAnswersResult = await client.query(questionsAndAnswersQuery, [quizId]);
        const correctAnswersMap = new Map(); // Store correct answers by question_id
        let maxPossibleScore = 0;
        questionsAndAnswersResult.rows.forEach(q => {
            correctAnswersMap.set(q.question_id, { 
                type: q.question_type, 
                points: q.points, 
                correct_ids: q.correct_option_ids 
            });
            maxPossibleScore += q.points; // Sum up points for max score
        });

        // --- 3. Save and Grade Each Submitted Answer ---
        let userScore = 0;
        const answerInsertValues = [];
        const answerInsertParams = [];
        let paramCounter = 1;

        for (const answer of answers) {
            const questionId = answer.question_id;
            const selectedOptionIds = answer.selected_option_ids || []; // Array of IDs for multi-choice
            const answerText = answer.answer_text || null; // Text for short answer

            if (!correctAnswersMap.has(questionId)) {
                console.warn(`Submitted answer for non-existent question ID ${questionId} in quiz ${quizId}. Skipping.`);
                continue; // Skip answers for questions not in the map
            }

            const questionData = correctAnswersMap.get(questionId);
            let isCorrect = false;
            let pointsAwarded = 0;

            // --- Grading Logic ---
            if (questionData.type.startsWith('multiple_choice')) {
                // Sort both arrays numerically to compare
                const correctIdsSorted = [...questionData.correct_ids].sort((a, b) => a - b);
                const selectedIdsSorted = [...selectedOptionIds].sort((a, b) => a - b);

                // Check if the arrays are identical
                isCorrect = correctIdsSorted.length === selectedIdsSorted.length && 
                            correctIdsSorted.every((value, index) => value === selectedIdsSorted[index]);
            } 
            // Add grading logic for 'true_false' (compare selected_option_ids[0] to correct_ids[0])
            // Add grading logic for 'short_answer' (simple case-insensitive comparison or more complex)
            else if (questionData.type === 'short_answer') {
                 // Basic example: case-insensitive match (needs correct answer stored differently, e.g., in quiz_questions table)
                 // isCorrect = answerText?.toLowerCase() === questionData.correct_answer_text?.toLowerCase(); 
                 // For now, let's assume short answers need manual grading or aren't auto-graded
                 isCorrect = null; // Mark as null for manual grading later
                 pointsAwarded = 0; // Or award partial points if possible
            }

            if (isCorrect === true) { // Only award points if definitively correct
                pointsAwarded = questionData.points;
                userScore += pointsAwarded;
            }
            // ---------------------

            // Prepare for multi-row insert
            answerInsertParams.push(`($${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
            answerInsertValues.push(submissionId, questionId, selectedOptionIds, answerText, isCorrect, pointsAwarded);
        }

        // Insert all answers at once
        if (answerInsertValues.length > 0) {
            const answersQuery = `
                INSERT INTO submission_answers 
                (submission_id, question_id, selected_option_ids, answer_text, is_correct, points_awarded)
                VALUES ${answerInsertParams.join(', ')};
            `;
            await client.query(answersQuery, answerInsertValues);
        }

        // --- 4. Update the Submission with Final Score ---
        await client.query(
            'UPDATE quiz_submissions SET score = $1, max_possible_score = $2, completed_at = NOW() WHERE id = $3',
            [userScore, maxPossibleScore, submissionId]
        );

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Quiz submitted successfully.',
            submissionId: submissionId,
            score: userScore,
            maxPossibleScore: maxPossibleScore
            // Maybe return detailed results or just the score
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Submit Quiz Error:', error);
        next(new AppError('Internal server error submitting quiz.', 500));
    } finally {
        client.release();
    }
};

exports.listQuizzesForCourse = async (req, res, next) => {
    const { courseId } = req.params;

    try {
        // Fetch basic quiz details for listing
        const query = `
            SELECT 
                q.id, q.title, q.description, q.time_limit_minutes, q.due_date, 
                (SELECT COUNT(id) FROM quiz_questions WHERE quiz_id = q.id) AS total_questions,
                (SELECT COUNT(id) FROM quiz_submissions WHERE quiz_id = q.id AND user_id = $2) AS submitted_count
            FROM quizzes q
            WHERE q.course_id = $1
            ORDER BY q.created_at DESC;
        `;
        // Note: The $2 parameter (req.userData.userId) is required to check if the user has submitted the quiz.

        const result = await pool.query(query, [courseId, req.userData.userId]);

        res.status(200).json({
            quizzes: result.rows
        });

    } catch (error) {
        console.error('List Quizzes Error:', error);
        next(new AppError('Internal server error listing quizzes.', 500));
    }
};