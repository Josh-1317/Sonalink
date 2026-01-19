const pool = require('../models/db'); // Adjust path if needed
const AppError = require('./appError'); // Adjust path if needed

// @route   GET /api/search/suggestions?q=...
// @desc    Get quick search suggestions for materials and courses
// @access  Public (or Private if you only want logged-in users to search)
exports.getSearchSuggestions = async (req, res, next) => {
    const query = req.query.q; // Get the search query string

    // Basic validation - ensure query is present and not too short
    if (!query || query.trim().length < 2) { 
        return res.json([]); // Return empty array if query is too short or missing
    }

    // Sanitize query for ILIKE - escape special characters and add wildcards
    const searchTerm = `%${query.trim().replace(/[%_]/g, '\\$&')}%`; 

    try {
        // --- Search Materials ---
        const materialsQuery = `
            SELECT 
                id, 
                title AS label, 
                'material' AS type 
            FROM materials 
            WHERE title ILIKE $1 
            ORDER BY created_at DESC -- Prioritize recent materials slightly
            LIMIT 5; -- Limit results for suggestions
        `;
        const materialsResult = await pool.query(materialsQuery, [searchTerm]);

        // --- Search Courses ---
        const coursesQuery = `
            SELECT 
                id, 
                name AS label, 
                'course' AS type 
            FROM courses 
            WHERE name ILIKE $1 OR code ILIKE $1
            ORDER BY name
            LIMIT 5; -- Limit results for suggestions
        `;
        const coursesResult = await pool.query(coursesQuery, [searchTerm]);

        // --- Combine Results ---
        // Combine and potentially limit total suggestions if needed
        const suggestions = [...materialsResult.rows, ...coursesResult.rows];

        // You could add logic here to interleave or further limit total results
        // For now, just send the combined list (up to 10 items)

        res.status(200).json(suggestions);

    } catch (error) {
        console.error('Search Suggestions Error:', error);
        next(new AppError('Internal server error during search.', 500));
    }
};

exports.getFullSearchResults = async (req, res, next) => {
    const query = req.query.q; // Search query
    const type = req.query.type || 'all'; // Optional: filter by type (e.g., 'materials', 'courses')
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // Smaller limit for combined results
    const offset = (page - 1) * limit;

    if (!query || query.trim().length < 2) {
        return res.json({ materials: [], courses: [], users: [], posts: [] }); // Return empty structure
    }

    // Sanitize query for ILIKE
    const searchTerm = `%${query.trim().replace(/[%_]/g, '\\$&')}%`;

    try {
        const results = {
            materials: [],
            courses: [],
            // Add users: [], posts: [] later when those are searchable
        };

        // --- Search Materials (if requested or 'all') ---
        if (type === 'all' || type.includes('materials')) {
            const materialsQuery = `
                SELECT 
                    m.id, m.title, m.description, m.file_type, m.original_filename,
                    m.upvotes, m.downloads, m.created_at,
                    json_build_object('id', u.id, 'name', u.name) as uploader,
                    c.id as course_id, c.name as course_name
                FROM materials m
                JOIN users u ON m.uploader_id = u.id
                JOIN courses c ON m.course_id = c.id
                WHERE m.title ILIKE $1 OR m.description ILIKE $1 
                ORDER BY m.created_at DESC 
                LIMIT $2 OFFSET $3;
            `;
            // Note: Add pagination later if needed across combined types
            const materialsResult = await pool.query(materialsQuery, [searchTerm, limit, offset]);
            results.materials = materialsResult.rows;
        }

        // --- Search Courses (if requested or 'all') ---
        if (type === 'all' || type.includes('courses')) {
             const coursesQuery = `
                SELECT 
                    id, code, name, description 
                FROM courses 
                WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1
                ORDER BY name
                LIMIT $2 OFFSET $3; 
            `;
            // Note: Add pagination later if needed across combined types
            const coursesResult = await pool.query(coursesQuery, [searchTerm, limit, offset]);
            results.courses = coursesResult.rows;
        }

        // --- Search Users (Add later) ---
        // if (type === 'all' || type.includes('users')) { ... }

        // --- Search Forum Posts (Add later) ---
        // if (type === 'all' || type.includes('posts')) { ... }

        // TODO: Implement proper pagination across combined result types if needed.
        // The current LIMIT/OFFSET applies independently to each type.

        res.status(200).json(results);

    } catch (error) {
        console.error('Full Search Error:', error);
        next(new AppError('Internal server error during search.', 500));
    }
};