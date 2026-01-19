const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/checkAuth');
const coursesController = require('../controllers/courses.controller');
const materialsController = require('../controllers/materials.controller');
const fileUpload = require('../middleware/file-upload');
const courseController = require('../controllers/courses.controller');

// GET /api/courses - List all available courses (public)
router.get('/', coursesController.getAllCourses);

// POST /api/courses/:courseId/enroll
router.post('/:courseId/enroll', checkAuth, coursesController.enrollInCourse);

// DELETE /api/courses/:courseId/enroll
router.delete('/:courseId/enroll', checkAuth, coursesController.unenrollFromCourse);

// GET /api/courses/:courseId/materials - Get materials for a specific course
router.get('/:courseId/materials', materialsController.getMaterialsForCourse);

// POST /api/courses/:courseId/materials - Upload a material to a specific course
router.post('/:courseId/materials', checkAuth, fileUpload.materialMulterUpload, fileUpload.uploadMaterialToCloudinary, materialsController.uploadMaterial);

// GET /api/courses/:id/members - Get list of all users enrolled in a course
router.get('/:id/members', checkAuth, courseController.getCourseMembers);

module.exports = router;