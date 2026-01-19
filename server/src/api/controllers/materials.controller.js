const pool = require('../models/db'); // Adjust path if needed
const cloudinary = require('cloudinary').v2;
const https = require('https');
const contentDisposition = require('content-disposition');
const AppError = require('./appError'); // Adjust path if needed

exports.getAllMaterials = async (req, res, next) => {
    // Basic pagination and sorting options from query params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // Default limit for global view
    const offset = (page - 1) * limit;
    const { sort, tag } = req.query; // Add tag filtering possibility

    try {
        let orderByClause = 'ORDER BY m.created_at DESC'; // Default sort: recent

        // Determine sorting order based on query param
        switch (sort) {
            case 'top':
                orderByClause = 'ORDER BY m.upvotes DESC, m.created_at DESC';
                break;
            case 'most_downloaded':
                orderByClause = 'ORDER BY m.downloads DESC, m.created_at DESC';
                break;
            // 'recent' is handled by default
        }

        // Base query - similar to getMaterialsForCourse but without course filter initially
        let baseQuery = `
            SELECT
                m.id, m.title, m.description, m.file_url, m.file_type, m.original_filename,
                m.upvotes, m.downloads, m.created_at,
                json_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) as uploader,
                m.course_id, -- Include course_id
                c.code as course_code, c.name as course_name, -- Include course details
                COALESCE(ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
            FROM materials m
            JOIN users u ON m.uploader_id = u.id
            JOIN courses c ON m.course_id = c.id -- Join courses to get details
            LEFT JOIN material_tags mt ON m.id = mt.material_id
            LEFT JOIN tags t ON mt.tag_id = t.id
        `;

        let whereClause = ''; // No default WHERE clause
        let queryParams = [];
        let paramIndex = 1;

        // Add tag filtering if requested
        if (tag) {
            whereClause = `
                WHERE m.id IN (
                    SELECT mt_sub.material_id FROM material_tags mt_sub
                    JOIN tags t_sub ON mt_sub.tag_id = t_sub.id
                    WHERE t_sub.name = $${paramIndex++}
                )
            `;
            queryParams.push(tag);
        }

        // Add limit and offset params
        queryParams.push(limit);
        queryParams.push(offset);
        let paginationClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

        // Final query construction
        const query = `
            ${baseQuery}
            ${whereClause}
            GROUP BY m.id, u.id, u.name, u.avatar_url, c.id, c.code, c.name -- Group by necessary fields
            ${orderByClause}
            ${paginationClause};
        `;

        // Count total items matching the filter for pagination
        let countQuery;
        let countParams = [];
        if (tag) {
            countQuery = `SELECT COUNT(DISTINCT m.id) FROM materials m JOIN material_tags mt ON m.id = mt.material_id JOIN tags t ON mt.tag_id = t.id WHERE t.name = $1`;
            countParams.push(tag);
        } else {
            countQuery = `SELECT COUNT(id) FROM materials;`;
        }

        // Execute queries concurrently
        const [results, countResult] = await Promise.all([
             pool.query(query, queryParams),
             pool.query(countQuery, countParams)
        ]);

        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        res.status(200).json({
            items: results.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit
            }
        });

    } catch (error) {
        console.error('Get All Materials Error:', error);
        next(new AppError('Internal server error fetching materials.', 500));
    }
};

exports.uploadMaterial = async (req, res, next) => { // Added next
    let { title, description, tags } = req.body;
    const { courseId } = req.params;
    const { userId: uploaderId } = req.userData;

    if (!title) {
        return next(new AppError('Title is required.', 400));
    }
    if (!req.cloudinary || !req.file) {
        return next(new AppError('File upload failed or missing.', 400));
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const uploadResult = req.cloudinary;
        const originalFilename = req.file.originalname; // <-- Get original filename

        // Save material to database, including original_filename
        const newMaterialResult = await client.query(
            `INSERT INTO materials (title, description, file_url, file_public_id, file_type, uploader_id, course_id, original_filename)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [title, description, uploadResult.secure_url, uploadResult.public_id, uploadResult.format, uploaderId, courseId, originalFilename]
        );
        const newMaterial = newMaterialResult.rows[0];

        // Handle tags
        const tagNames = (tags && typeof tags === 'string' && tags.trim() !== '')
            ? [...new Set(tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag))]
            : [];

        if (tagNames.length > 0) {
            const upsertTagsQuery = `
                INSERT INTO tags (name)
                SELECT unnest($1::text[])
                ON CONFLICT (name) DO NOTHING;
            `;
            await client.query(upsertTagsQuery, [tagNames]);

            const linkTagsQuery = `
                INSERT INTO material_tags (material_id, tag_id)
                SELECT $1, t.id
                FROM tags t
                WHERE t.name = ANY($2::text[]);
            `;
            await client.query(linkTagsQuery, [newMaterial.id, tagNames]);
        }

        await client.query('COMMIT');

        res.status(201).json(newMaterial);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('File Upload Error:', error);
        next(new AppError('Internal server error during file upload.', 500)); // Use next
    } finally {
        client.release();
    }
};

exports.getMaterialsForCourse = async (req, res, next) => { // Added next
    const { courseId } = req.params;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { tag, sort } = req.query; // Added sort query param

    try {
        let query;
        let queryParams;

        // Base query with tags aggregation and uploader object
        const baseQuery = `
            SELECT
                m.id, m.title, m.description, m.file_url, m.file_type, m.original_filename,
                m.upvotes, m.downloads, m.created_at,
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                ) as uploader,
                COALESCE(ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
            FROM materials m
            JOIN users u ON m.uploader_id = u.id
            LEFT JOIN material_tags mt ON m.id = mt.material_id
            LEFT JOIN tags t ON mt.tag_id = t.id
        `;

        // Build WHERE and ORDER BY clauses
        let whereClause = 'WHERE m.course_id = $1';
        let orderByClause = 'ORDER BY ';

        switch (sort) {
            case 'top':
                orderByClause += 'm.upvotes DESC, m.created_at DESC';
                break;
            case 'most_downloaded':
                orderByClause += 'm.downloads DESC, m.created_at DESC';
                break;
            case 'recent':
            default:
                orderByClause += 'm.created_at DESC';
        }

        queryParams = [courseId];
        let paramIndex = 2; // Start after courseId

        if (tag) {
             whereClause += ` AND m.id IN (
                 SELECT mt_sub.material_id FROM material_tags mt_sub
                 JOIN tags t_sub ON mt_sub.tag_id = t_sub.id
                 WHERE t_sub.name = $${paramIndex++}
             )`;
            queryParams.push(tag);
        }

        // Add limit and offset params
        queryParams.push(limit);
        queryParams.push(offset);
        let paginationClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

        query = `
            ${baseQuery}
            ${whereClause}
            GROUP BY m.id, u.id, u.name, u.avatar_url
            ${orderByClause}
            ${paginationClause};
        `;

        // console.log("Executing query:", query); // Uncomment for debugging
        // console.log("Query params:", queryParams); // Uncomment for debugging

        const { rows } = await pool.query(query, queryParams);

        // Fetch total count for pagination
        let countQuery;
        let countParams = [courseId];
        if (tag) {
            countQuery = `SELECT COUNT(DISTINCT m.id) FROM materials m JOIN material_tags mt ON m.id = mt.material_id JOIN tags t ON mt.tag_id = t.id WHERE m.course_id = $1 AND t.name = $2`;
            countParams.push(tag);
        } else {
            countQuery = `SELECT COUNT(id) FROM materials WHERE course_id = $1`;
        }
        const countResult = await pool.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // Return structured response
        res.status(200).json({
            items: rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit
            }
        });

    } catch (error) {
        console.error('Get Materials Error:', error);
        next(new AppError('Internal server error listing materials.', 500)); // Use next
    }
};

// --- CORRECTED getMaterialById ---
exports.getMaterialById = async (req, res, next) => {
    const { materialId } = req.params;
    console.log(`Fetching details for material ID: ${materialId}`);

    try {
        const query = `
            SELECT
                m.id, m.title, m.description, m.file_url, m.file_type,
                m.original_filename, m.upvotes, m.downloads, m.created_at,
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar_url', u.avatar_url
                ) as uploader,
                COALESCE(ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
            FROM materials m
            JOIN users u ON m.uploader_id = u.id
            LEFT JOIN material_tags mt ON m.id = mt.material_id
            LEFT JOIN tags t ON mt.tag_id = t.id
            WHERE m.id = $1
            GROUP BY m.id, u.id, u.name, u.avatar_url;
        `;

        const { rows } = await pool.query(query, [materialId]);

        if (rows.length === 0) {
            return next(new AppError('Material not found.', 404));
        }

        console.log("Material details fetched successfully.");
        res.status(200).json(rows[0]);

    } catch (error) {
        console.error('Get Material By ID Error:', error);
        next(new AppError('Internal server error fetching material details.', 500));
    }
};


// --- CORRECTED upvoteMaterial ---
exports.upvoteMaterial = async (req, res, next) => { // Added next
    const { materialId } = req.params;
    const { userId } = req.userData;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check using 'upvotes' table
        const existingVote = await client.query(
            'SELECT vote_type FROM upvotes WHERE user_id = $1 AND material_id = $2',
            [userId, materialId]
        );

        let voteChange = 0;
        let message = '';

        if (existingVote.rows.length > 0) {
            // Vote exists, remove it
            await client.query('DELETE FROM upvotes WHERE user_id = $1 AND material_id = $2', [userId, materialId]);
            voteChange = -1 * existingVote.rows[0].vote_type; // Adjust count based on previous vote
            message = 'Vote removed.';
        } else {
            // No vote exists, add an upvote (vote_type = 1)
            await client.query('INSERT INTO upvotes (user_id, material_id, vote_type) VALUES ($1, $2, 1)', [userId, materialId]);
            voteChange = 1;
            message = 'Material upvoted successfully.';
        }

        // Update materials count
        const updateResult = await client.query(
            'UPDATE materials SET upvotes = upvotes + $1 WHERE id = $2 RETURNING upvotes',
            [voteChange, materialId]
        );

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return next(new AppError('Material not found during upvote update.', 404));
        }
        const newUpvoteCount = updateResult.rows[0].upvotes;

        await client.query('COMMIT');
        res.status(200).json({ message, upvotes: newUpvoteCount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Upvote Error:', error);
        next(new AppError('Internal server error processing vote.', 500)); // Use next
    } finally {
        client.release();
    }
};


// --- CORRECTED downloadMaterial ---
exports.downloadMaterial = async (req, res, next) => { // Added next
    const { materialId } = req.params;
    console.log(`Download request received for materialId: ${materialId}`);

    try {
        // Increment download count AND get file details including original_filename
        const updateQuery = `
            UPDATE materials
            SET downloads = downloads + 1
            WHERE id = $1
            RETURNING file_public_id, file_type, original_filename; -- Ensure original_filename is fetched
        `;
        console.log("Executing DB query...");
        const result = await pool.query(updateQuery, [materialId]);
        console.log("DB query executed.");

        if (result.rows.length === 0) {
            console.log(`Material with ID ${materialId} not found.`);
            return next(new AppError('Material not found.', 404)); // Use next
        }

        const materialData = result.rows[0];
        console.log("Material data fetched:", materialData);
        // Destructure including original_filename
        const { file_public_id, file_type, original_filename } = materialData;

        if (!file_public_id) {
            console.error('Error: file_public_id is missing from database result.');
            return next(new AppError('Internal server error: Missing file identifier.', 500)); // Use next
        }

        // Determine resource type
        let resourceType = 'raw';
        if (file_type?.startsWith('image/')) {
            resourceType = 'image';
        } else if (file_type?.startsWith('video/')) {
            resourceType = 'video';
        }
        console.log(`Determined resource type: ${resourceType}`);

        // Generate a signed URL using original_filename
        console.log("Generating Cloudinary download URL...");
        const downloadUrl = cloudinary.utils.private_download_url(
            file_public_id,
            original_filename?.split('.').pop() || file_type || '', // Use extension from name first
            {
                resource_type: resourceType,
                type: 'upload',
                // Use original_filename for attachment
                attachment: original_filename || `download.${file_type || 'bin'}`,
            }
        );
        console.log("Generated download URL:", downloadUrl);

        if (!downloadUrl) {
             console.error("Error: Cloudinary URL generation returned undefined/null.");
             return next(new AppError('Internal server error: Failed to generate download link.', 500)); // Use next
        }

        // Redirect the user
        console.log("Redirecting user to download URL...");
        res.redirect(downloadUrl);
        console.log("Redirect initiated.");

    } catch (error) {
        console.error('Download Error (Caught):', error);
        // Use next for error handling
        if (!res.headersSent) {
             next(new AppError('Internal server error during download.', 500));
        }
    }
};


// --- CORRECTED deleteMaterial ---
exports.deleteMaterial = async (req, res, next) => { // Added next
    const { materialId } = req.params;
    const { userId } = req.userData;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Fetch needed details including file_type
        const materialResult = await client.query(
            'SELECT uploader_id, file_public_id, file_type FROM materials WHERE id = $1',
            [materialId]
        );

        if (materialResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return next(new AppError('Material not found.', 404)); // Use next
        }

        const material = materialResult.rows[0];

        if (material.uploader_id !== userId) {
            await client.query('ROLLBACK');
            client.release();
            return next(new AppError('Forbidden: You cannot delete this material.', 403)); // Use next
        }

        // Delete from Database
        await client.query('DELETE FROM materials WHERE id = $1', [materialId]);

        // Delete from Cloudinary
        if (material.file_public_id) {
            try {
                // Determine resource type for deletion
                let resourceType = 'image'; // Default
                 if (material.file_type === 'application/pdf' || material.file_type?.includes('doc') || material.file_type?.includes('ppt') || material.file_type === null) {
                      resourceType = 'raw';
                 } else if (material.file_type?.startsWith('video/')) {
                      resourceType = 'video';
                 }

                await cloudinary.uploader.destroy(material.file_public_id, { resource_type: resourceType });
            } catch (cloudinaryError) {
                console.error(`Cloudinary Delete Error (Public ID: ${material.file_public_id}, Type: ${resourceType}):`, cloudinaryError);
                // Log but don't rollback
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Material deleted successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete Material Error:', error);
        next(new AppError('Internal server error deleting material.', 500)); // Use next
    } finally {
        client.release();
    }
};
