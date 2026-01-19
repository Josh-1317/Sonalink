const express = require('express');
const cors = require('cors');
const config = require('./config');

// Import your routes
const authRoutes = require('./api/routes/auth.routes');
const materialsRoutes = require('./api/routes/materials.routes');
const userRoutes = require('./api/routes/users.routes');
const courseRoutes = require('./api/routes/courses.routes');
const AppError = require('./api/controllers/appError'); // Correct path from src/app.js
const globalErrorHandler = require('./api/middleware/errorHandler');
const searchRoutes = require('./api/routes/search.routes');
const forumRoutes = require('./api/routes/forum.routes');
const quizRoutes = require('./api/routes/quiz.routes');
const submissionRoutes = require('./api/routes/submission.routes');
const notificationActionRoutes = require('./api/routes/notification.routes'); 

const app = express();

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); // To parse JSON request bodies

// --- API ROUTES ---
// The order of registration matters.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses/:courseId/forum', forumRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/courses/:courseId/quizzes', quizRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationActionRoutes);
app.use('/api/search', searchRoutes);

// Catch-all for undefined routes. This must be after all other valid routes.
app.use((req, res, next) => {
    // If the request hasn't been handled by any route above,
    // create a 404 error and pass it to the error handler.
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
// --- GLOBAL ERROR HANDLER ---
app.use(globalErrorHandler);

// --- SERVER START ---
app.listen(config.port, () => {
    console.log(`🚀 Server is running on port ${config.port}`);
});

module.exports = app; // Export for testing purposes