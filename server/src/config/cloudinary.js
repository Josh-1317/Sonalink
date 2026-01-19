const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const config = require('../config');

// Configure Cloudinary with credentials from your central config
cloudinary.config(config.cloudinary);

const uploadFromBuffer = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', ...options }, // Merge with passed options
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

module.exports = { uploadFromBuffer };