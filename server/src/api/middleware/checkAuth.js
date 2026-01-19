const jwt = require('jsonwebtoken');
const config = require('../../config');

module.exports = (req, res, next) => {
    try {
        // Get token from header (format: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authentication failed: No token provided.' });
        }
        const token = authHeader.split(' ')[1];

        // Verify token
        const decodedToken = jwt.verify(token, config.jwtSecret);

        // Attach user data to the request object
        req.userData = { userId: decodedToken.userId };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
    }
};