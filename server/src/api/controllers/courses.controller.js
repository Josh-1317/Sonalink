const pool = require('../models/db');

exports.getAllCourses = async (req, res) => {
    try {
        const query = `
            SELECT id, code, name, description FROM courses ORDER BY code;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get All Courses Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.enrollInCourse = async (req, res) => {
    const { courseId } = req.params;
    const { userId } = req.userData; // from checkAuth middleware

    try {
        // Check if the course exists to provide a better error message
        const courseResult = await pool.query('SELECT id FROM courses WHERE id = $1', [courseId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        // Attempt to enroll the user
        await pool.query(
            'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)',
            [userId, courseId]
        );

        res.status(201).json({ message: 'Successfully enrolled in the course.' });

    } catch (error) {
        // Check for primary key violation (user is already enrolled)
        if (error.code === '23505') { // '23505' is the code for unique_violation
            return res.status(409).json({ message: 'You are already enrolled in this course.' });
        }
        
        console.error('Enrollment Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.unenrollFromCourse = async (req, res) => {
    const { courseId } = req.params;
    const { userId } = req.userData;

    try {
        const result = await pool.query(
            'DELETE FROM enrollments WHERE user_id = $1 AND course_id = $2',
            [userId, courseId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Enrollment not found. You are not enrolled in this course.' });
        }

        res.status(200).json({ message: 'Successfully unenrolled from the course.' });
    } catch (error) {
        console.error('Unenrollment Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getCourseMembers = async (req, res, next) => {
    const { id: courseId } = req.params;

    try {
        // Query to fetch all users enrolled in the course, selecting only public-safe fields.
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.avatar_url, 
                u.role, 
                u.bio 
            FROM users u
            JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = $1
            ORDER BY u.name;
        `;

        const result = await pool.query(query, [courseId]);

        if (result.rows.length === 0) {
             // Check if the course itself exists before sending 404/empty.
             // Assuming the 'enrollments' table handles the existence check for now.
             return res.status(200).json({ members: [] });
        }

        res.status(200).json({
            members: result.rows,
            courseId: courseId
        });

    } catch (error) {
        console.error('Get Course Members Error:', error);
        // Handle potential foreign key violation if courseId is invalid
        next(new AppError('Internal server error fetching course members.', 500));
    }
};