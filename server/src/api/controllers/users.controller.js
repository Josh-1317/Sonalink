const pool = require('../models/db'); // Adjust path if needed
const cloudinary = require('cloudinary').v2;
const AppError = require('./appError.js'); // Use './' for the same directory

exports.updateUserProfile = async (req, res, next) => { // Added next
    const { userId } = req.userData; // From checkAuth middleware
    const { name, bio } = req.body;

    const fieldsToUpdate = [];
    const values = [];
    let queryIndex = 1;

    if (name && name.trim() !== '') {
        fieldsToUpdate.push(`name = $${queryIndex++}`);
        values.push(name);
    }
    // Allow empty string for bio to clear it
    if (bio !== undefined && bio !== null) {
        fieldsToUpdate.push(`bio = $${queryIndex++}`);
        values.push(bio);
    }

    if (fieldsToUpdate.length === 0) {
        return next(new AppError('No fields to update. Please provide a name or bio.', 400));
    }

    values.push(userId); // Add userId for the WHERE clause

    try {
        const query = `
            UPDATE users
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${queryIndex}
            RETURNING id, name, email, bio, avatar_url AS avatar -- Return avatar_url as avatar
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
             return next(new AppError('User not found.', 404)); // Handle case where user ID is invalid
        }

        res.status(200).json({ message: 'Profile updated successfully.', user: result.rows[0] });
    } catch (error) {
        console.error('Update Profile Error:', error);
        next(new AppError('Internal server error updating profile.', 500)); // Use next
    }
};

exports.updateUserAvatar = async (req, res, next) => { // Added next
    // Check if middleware attached Cloudinary result and file
    if (!req.cloudinary || !req.file) {
        return next(new AppError('Avatar upload failed or file missing.', 400));
    }

    const userId = req.userData.id; // Corrected: Get id from userData
    const newAvatarResult = req.cloudinary; // Result from uploadToCloudinary middleware

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- STEP 1: Get the OLD avatar's public_id BEFORE updating ---
        const oldAvatarResult = await client.query(
            // Ensure you have this column in your DB
            'SELECT avatar_public_id FROM users WHERE id = $1',
            [userId]
        );
        const oldPublicId = oldAvatarResult.rows[0]?.avatar_public_id;
        console.log("Old avatar public_id:", oldPublicId);

        // --- STEP 2: Update the user record with NEW avatar URL and public_id ---
        const updateQuery = `
            UPDATE users
            SET avatar_url = $1, avatar_public_id = $2
            WHERE id = $3
            RETURNING avatar_url`; // Return the new URL
        const updatedUser = await client.query(updateQuery, [
            newAvatarResult.secure_url,
            newAvatarResult.public_id, // Save the new public_id
            userId
        ]);

        if (updatedUser.rows.length === 0) {
             await client.query('ROLLBACK');
             return next(new AppError('User not found during avatar update.', 404));
        }

        await client.query('COMMIT'); // Commit DB changes

         // --- STEP 3: Delete the OLD avatar from Cloudinary AFTER DB commit ---
         if (oldPublicId && oldPublicId !== newAvatarResult.public_id) {
             try {
                 console.log(`Attempting to delete old avatar: ${oldPublicId}`);
                 await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' }); // Avatars are images
                 console.log(`Successfully deleted old avatar: ${oldPublicId}`);
             } catch (deleteError) {
                 console.error(`Failed to delete old avatar (${oldPublicId}) from Cloudinary:`, deleteError);
                 // Log error but don't fail the overall request
             }
         }

        res.json({
            message: 'Avatar updated successfully',
            avatar_url: updatedUser.rows[0].avatar_url, // Return the URL
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update Avatar Error:', error);
        next(new AppError('Internal server error updating avatar.', 500));
    } finally {
        client.release();
    }
};

exports.getMe = async (req, res, next) => { // Added next
    try {
        const userResult = await pool.query(
            // Use avatar_url consistently
            'SELECT id, name, email, bio, avatar_url AS avatar, created_at FROM users WHERE id = $1',
            [req.userData.userId] // Corrected: Get id from userData
        );

        if (userResult.rows.length === 0) {
            return next(new AppError('User not found.', 404));
        }

        res.status(200).json({ user: userResult.rows[0] });
    } catch (error) {
        console.error('Get Me Error:', error); // Log the specific error
        next(new AppError('Internal server error while fetching user profile.', 500));
    }
};

exports.getUserProfile = async (req, res, next) => { // Added next
    const { id } = req.params;

    try {
        const userResult = await pool.query(
            // Use avatar_url consistently
            'SELECT id, name, bio, avatar_url AS avatar, created_at FROM users WHERE id = $1',
            [id]
        );

        if (userResult.rows.length === 0) {
            return next(new AppError('User not found.', 404));
        }

        res.status(200).json({ user: userResult.rows[0] });
    } catch (error) {
        console.error('Get User Profile Error:', error); // Log the specific error
        next(new AppError('Internal server error while fetching user profile.', 500));
    }
};

exports.getEnrolledCourses = async (req, res, next) => { // Added next
    const { userId } = req.userData; // Corrected: Get id from userData

    try {
        const query = `
            SELECT c.id, c.code, c.name, c.description
            FROM courses c
            JOIN enrollments e ON c.id = e.course_id
            WHERE e.user_id = $1
            ORDER BY c.code;
        `;

        const result = await pool.query(query, [userId]);

        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Get Enrolled Courses Error:', error);
        next(new AppError('Internal server error', 500)); // Use next
    }
};

exports.getUserContributions = async (req, res, next) => {
    // Ensure 'next' is passed if using AppError
    const { userId } = req.userData; // ID of the logged-in user

    try {
        // 1. Get Uploaded Materials
        const materialsQuery = `
            SELECT
                m.id, m.title, m.file_type, m.original_filename, m.upvotes, m.downloads, m.created_at,
                c.id AS course_id, c.code AS course_code, c.name AS course_name
            FROM materials m
            JOIN courses c ON m.course_id = c.id
            WHERE m.uploader_id = $1
            ORDER BY m.created_at DESC;
        `;
        const materialsResult = await pool.query(materialsQuery, [userId]);

        // 2. Get Created Forum Threads (Questions)
        const threadsQuery = `
            SELECT
                ft.id, ft.title, ft.is_resolved, ft.created_at,
                c.id AS course_id, c.code AS course_code, c.name AS course_name,
                (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) AS reply_count
            FROM forum_threads ft
            JOIN courses c ON ft.course_id = c.id
            WHERE ft.creator_id = $1
            ORDER BY ft.created_at DESC;
        `;
        const threadsResult = await pool.query(threadsQuery, [userId]);

        // 3. Get User's Forum Replies
        const repliesQuery = `
            SELECT
                ft.title AS thread_title, ft.id AS thread_id, ft.course_id,
                c.code AS course_code, c.name AS course_name,
                fr.id AS reply_id, fr.body, fr.is_accepted_answer, fr.created_at
            FROM forum_replies fr
            JOIN forum_threads ft ON fr.thread_id = ft.id
            JOIN courses c ON ft.course_id = c.id
            WHERE fr.creator_id = $1
            ORDER BY fr.created_at DESC;
        `;
        const repliesResult = await pool.query(repliesQuery, [userId]);

        // Combine results
        res.status(200).json({
            materials: materialsResult.rows,
            threads: threadsResult.rows,
            replies: repliesResult.rows
        });

    } catch (error) {
        console.error('Get User Contributions Error:', error);
        // Ensure AppError is required at the top if you use next()
        next(new AppError('Internal server error fetching contributions.', 500));
    }
};