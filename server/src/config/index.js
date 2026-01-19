const dotenv = require('dotenv');
const path = require('path');

// Load the .env file from the root of the 'backend' directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
    db: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    },
    jwtSecret: process.env.JWT_SECRET,
    port: process.env.PORT || 3001,
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
};