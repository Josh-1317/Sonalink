const pool = require('../models/db'); // Adjust path if needed
const AppError = require('./appError'); // Adjust path if needed

// @route   POST /api/courses/:courseId/forum
// @desc    Create a new forum thread in a course
// @access  Private (Authenticated users)
exports.createThread = async (req, res, next) => {
    const { title, body } = req.body;
    const { courseId } = req.params;
    const { userId: creatorId } = req.userData; // From checkAuth middleware

    // Basic Validation
    if (!title || title.trim() === '') {
        return next(new AppError('Thread title cannot be empty.', 400));
    }
    // Body can potentially be empty if only title is needed, adjust if required
    // if (!body || body.trim() === '') {
    //     return next(new AppError('Thread body cannot be empty.', 400));
    // }

    try {
        // TODO: Add check to ensure user is enrolled in the courseId before allowing post? (Optional)

        const query = `
            INSERT INTO forum_threads (title, body, creator_id, course_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *; -- Return the newly created thread
        `;
        const values = [title, body, creatorId, courseId];

        const result = await pool.query(query, values);
        const newThread = result.rows[0];

        res.status(201).json({
            message: 'Forum thread created successfully.',
            thread: newThread
        });

    } catch (error) {
        // Handle potential foreign key constraint errors (e.g., invalid courseId)
        if (error.code === '23503') { // foreign_key_violation
             return next(new AppError('Invalid course ID.', 400));
        }
        console.error('Create Thread Error:', error);
        next(new AppError('Internal server error creating forum thread.', 500));
    }
    // No client.release() needed if using pool.query directly
};

// In forum.controller.js

exports.listThreadsForCourse = async (req, res, next) => {
    const { courseId } = req.params;
    // Add pagination later if needed
    // const page = parseInt(req.query.page, 10) || 1;
    // const limit = parseInt(req.query.limit, 10) || 20;
    // const offset = (page - 1) * limit;

    try {
        // TODO: Add check to ensure user is enrolled in the courseId? (Optional)

        // Query to get threads, joining with users to get creator's name
        // Also includes a count of replies for each thread
        const query = `
            SELECT 
                ft.id, 
                ft.title, 
                ft.body, 
                ft.creator_id, 
                u.name AS creator_name, 
                ft.course_id, 
                ft.is_resolved, 
                ft.created_at,
                (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) AS reply_count
            FROM forum_threads ft
            JOIN users u ON ft.creator_id = u.id
            WHERE ft.course_id = $1
            ORDER BY ft.created_at DESC; 
            -- Add LIMIT $2 OFFSET $3 here for pagination
        `;

        const result = await pool.query(query, [courseId]); // Add limit, offset for pagination

        res.status(200).json({
            threads: result.rows
            // Add pagination metadata here if implemented
        });

    } catch (error) {
        console.error('List Threads Error:', error);
        next(new AppError('Internal server error listing forum threads.', 500));
    }
};

exports.createReply = async (req, res, next) => {
    const { body } = req.body;
    const { threadId } = req.params;
    const { userId: creatorId } = req.userData; // From checkAuth

    // Basic Validation
    if (!body || body.trim() === '') {
        return next(new AppError('Reply body cannot be empty.', 400));
    }

    try {
        // Optional: Check if the thread exists first
        const threadExists = await pool.query('SELECT id FROM forum_threads WHERE id = $1', [threadId]);
        if (threadExists.rows.length === 0) {
             return next(new AppError('Forum thread not found.', 404));
        }

        // TODO: Optional: Check if user is enrolled in the course the thread belongs to?

        // Insert the new reply
        const query = `
            INSERT INTO forum_replies (body, thread_id, creator_id)
            VALUES ($1, $2, $3)
            RETURNING *; -- Return the newly created reply
        `;
        const values = [body, threadId, creatorId];

        const result = await pool.query(query, values);
        const newReply = result.rows[0];

        // Optional: Update thread's updated_at timestamp? (Requires adding a column)

        res.status(201).json({
            message: 'Reply added successfully.',
            reply: newReply
        });

    } catch (error) {
         // Handle potential foreign key constraint errors (e.g., invalid threadId - already checked above)
        console.error('Create Reply Error:', error);
        next(new AppError('Internal server error adding reply.', 500));
    }
};

exports.getThreadWithReplies = async (req, res, next) => {
    const { threadId } = req.params;

    try {
        // Query 1: Get the main thread details, including creator info
        const threadQuery = `
            SELECT 
                ft.id, ft.title, ft.body, ft.creator_id, ft.course_id, 
                ft.is_resolved, ft.created_at,
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                ) as creator
            FROM forum_threads ft
            JOIN users u ON ft.creator_id = u.id
            WHERE ft.id = $1;
        `;
        const threadResult = await pool.query(threadQuery, [threadId]);

        if (threadResult.rows.length === 0) {
            return next(new AppError('Forum thread not found.', 404));
        }
        const thread = threadResult.rows[0];

        // Query 2: Get all replies for this thread, including creator info
        const repliesQuery = `
            SELECT 
                fr.id, fr.body, fr.creator_id, fr.thread_id, 
                fr.is_accepted_answer, fr.created_at,
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                ) as creator
            FROM forum_replies fr
            JOIN users u ON fr.creator_id = u.id
            WHERE fr.thread_id = $1
            ORDER BY fr.created_at ASC; -- Show replies in chronological order
        `;
        const repliesResult = await pool.query(repliesQuery, [threadId]);
        const replies = repliesResult.rows;

        // Combine thread and replies into one response object
        res.status(200).json({
            thread: thread,
            replies: replies
        });

    } catch (error) {
        console.error('Get Thread/Replies Error:', error);
        next(new AppError('Internal server error fetching forum thread.', 500));
    }
};

exports.acceptAnswer = async (req, res, next) => {
    const { replyId } = req.params;
    const { userId } = req.userData; // ID of the user making the request

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- Step 1: Get the reply and its parent thread's creator ---
        const replyCheckQuery = `
            SELECT 
                fr.id AS reply_id, 
                fr.thread_id, 
                fr.is_accepted_answer,
                ft.creator_id AS thread_creator_id,
                ft.is_resolved AS thread_is_resolved
            FROM forum_replies fr
            JOIN forum_threads ft ON fr.thread_id = ft.id
            WHERE fr.id = $1;
        `;
        const replyCheckResult = await client.query(replyCheckQuery, [replyId]);

        if (replyCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return next(new AppError('Reply not found.', 404));
        }

        const replyData = replyCheckResult.rows[0];

        // --- Step 2: Authorization ---
        // Only allow the original creator of the THREAD to accept an answer
        if (replyData.thread_creator_id !== userId) {
             await client.query('ROLLBACK');
             client.release();
            return next(new AppError('Forbidden: Only the thread creator can accept an answer.', 403));
        }

        // Determine the new state (toggle)
        const newAcceptedState = !replyData.is_accepted_answer;

        // --- Step 3: Clear any previously accepted answer for this thread (if setting a new one) ---
        if (newAcceptedState) { // Only clear others if we are *setting* this one as accepted
            await client.query(
                'UPDATE forum_replies SET is_accepted_answer = false WHERE thread_id = $1 AND is_accepted_answer = true',
                [replyData.thread_id]
            );
        }

        // --- Step 4: Update the target reply's accepted status ---
        const updateReplyQuery = `
            UPDATE forum_replies 
            SET is_accepted_answer = $1 
            WHERE id = $2 
            RETURNING id, is_accepted_answer;
        `;
        const updatedReplyResult = await client.query(updateReplyQuery, [newAcceptedState, replyId]);
        const updatedReply = updatedReplyResult.rows[0];


        // --- Step 5: Update the parent thread's resolved status ---
        // If *any* reply is now accepted, mark the thread resolved. If *no* reply is accepted, mark it unresolved.
        const checkResolvedQuery = `SELECT EXISTS (SELECT 1 FROM forum_replies WHERE thread_id = $1 AND is_accepted_answer = true)`;
        const resolvedCheck = await client.query(checkResolvedQuery, [replyData.thread_id]);
        const newResolvedState = resolvedCheck.rows[0].exists;

        await client.query(
            'UPDATE forum_threads SET is_resolved = $1 WHERE id = $2',
            [newResolvedState, replyData.thread_id]
        );

        await client.query('COMMIT'); // Commit all changes

        res.status(200).json({
            message: `Reply ${newAcceptedState ? 'marked' : 'unmarked'} as accepted answer.`,
            reply: updatedReply,
            threadResolved: newResolvedState
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Accept Answer Error:', error);
        next(new AppError('Internal server error updating answer status.', 500));
    } finally {
        client.release();
    }
};

// In forum.controller.js

exports.getAllThreads = async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { sort } = req.query;

    try {
        let orderByClause = 'ORDER BY ft.created_at DESC'; // Default: recent
        // Add switch(sort) here if needed later

        // --- UPDATED QUERY ---
        const query = `
            SELECT
                ft.id, ft.title, ft.body, ft.creator_id, ft.course_id,
                ft.is_resolved, ft.created_at,
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                ) as creator,
                (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) AS reply_count
            FROM forum_threads ft
            JOIN users u ON ft.creator_id = u.id
            -- No course filter here
            GROUP BY ft.id, u.id, u.name, u.avatar_url -- << GROUP BY comes BEFORE ORDER BY
            ${orderByClause}                           -- << ORDER BY comes AFTER GROUP BY
            LIMIT $1 OFFSET $2;
        `;
        // --- END UPDATED QUERY ---

        const countQuery = `SELECT COUNT(id) FROM forum_threads;`;

        const [results, countResult] = await Promise.all([
             pool.query(query, [limit, offset]),
             pool.query(countQuery)
        ]);

        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        res.status(200).json({
            threads: results.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit
            }
        });

    } catch (error) {
        console.error('Get All Threads Error:', error);
        next(new AppError('Internal server error listing forum threads.', 500));
    }
};