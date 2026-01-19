const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// --- AVATAR (IMAGE) UPLOADER ---

const avatarStorage = multer.memoryStorage();
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), false);
        }
    }
});

// Middleware for handling avatar file from request
const avatarMulterUpload = (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) return res.status(400).json({ message: 'Invalid file type (images only) or size.' });
        next();
    });
};

// Middleware for uploading avatar to Cloudinary
const uploadAvatarToCloudinary = (req, res, next) => {
    if (!req.file) return res.status(400).json({ message: 'No avatar file provided.' });
    
    const cld_upload_stream = cloudinary.uploader.upload_stream(
        { // 1. Options
            folder: 'avatars',
            public_id: `user_${req.userData.userId}`,
            overwrite: true,
            resource_type: 'image', // Force as image
            transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }]
        },
        (error, result) => { // 2. Callback
            if (error) return res.status(500).json({ message: 'Cloudinary upload failed.' });
            req.cloudinary = result;
            next();
        }
    );
    streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
};


// --- MATERIAL (PDF, DOCX) UPLOADER ---

const materialStorage = multer.memoryStorage();
const materialUpload = multer({
    storage: materialStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx/;
        if (allowedTypes.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), false);
        }
    }
});

// Middleware for handling material file from request
//...
const materialMulterUpload = (req, res, next) => {
    // This key MUST match Postman
    materialUpload.single('materialFile')(req, res, (err) => { 
        if (err) return res.status(400).json({ message: 'Invalid file type or size.' });
        next();
    });
};
//...
// Middleware for uploading material to Cloudinary
const uploadMaterialToCloudinary = (req, res, next) => {
    if (!req.file) return res.status(400).json({ message: 'No file provided.' });

    const { courseId } = req.params;
    const folder = `sonalink/courses/${courseId}`;

    // --- NEW LOGIC ---
    // Determine the resource type based on the file's mimetype
    let resourceType;
    if (req.file.mimetype.startsWith('image/')) {
        resourceType = 'image';
    } else if (req.file.mimetype === 'application/pdf') {
        resourceType = 'raw'; // Force 'raw' for PDFs
    } else {
        resourceType = 'auto'; // Use 'auto' for other types (like docx)
    }
    // ---------------

    console.log(`Uploading file: ${req.file.originalname}, Mimetype: ${req.file.mimetype}, Determined resource_type: ${resourceType}`); // Add logging

    const cld_upload_stream = cloudinary.uploader.upload_stream(
        { // 1. Options object
            folder: folder,
            // --- USE THE DETERMINED resourceType ---
            resource_type: resourceType,
            // ------------------------------------
            use_filename: true,    // Keep these
            unique_filename: false 
        },
        (error, result) => { // 2. Callback function
            if (error) {
                console.error('Cloudinary Material Upload Error:', error);
                return res.status(500).json({ message: 'Cloudinary upload failed.' });
            }
            
            // Log the result again to confirm
            console.log('Cloudinary Result (after fix):', result); 
            
            // Check if Cloudinary respected our choice
            if (result && result.resource_type !== resourceType && resourceType !== 'auto') {
                 console.warn(`Warning: Cloudinary returned resource_type '${result.resource_type}' but we requested '${resourceType}'`);
            }

            req.cloudinary = result;
            next();
        }
    );
    streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
};


module.exports = {
    avatarMulterUpload,
    uploadAvatarToCloudinary,
    materialMulterUpload,
    uploadMaterialToCloudinary
};