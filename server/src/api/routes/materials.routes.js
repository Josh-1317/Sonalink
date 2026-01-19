const express = require('express');
const checkAuth = require('../middleware/checkAuth');
const materialsController = require('../controllers/materials.controller');

const router = express.Router();

// GET /api/materials/:materialId (Get details for one material)
router.get('/:materialId', materialsController.getMaterialById);

// POST /api/materials/:materialId/upvote (Protected)
router.post('/:materialId/upvote', checkAuth, materialsController.upvoteMaterial);

// GET /api/materials/:materialId/download
router.get('/:materialId/download', materialsController.downloadMaterial);

// DELETE /api/materials/:materialId (Protected)
router.delete('/:materialId', checkAuth, materialsController.deleteMaterial);

// GET /api/materials - Get materials (can be filtered/sorted globally)
router.get('/', materialsController.getAllMaterials);

module.exports = router;