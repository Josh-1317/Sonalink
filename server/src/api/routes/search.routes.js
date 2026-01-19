const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
// const checkAuth = require('../middleware/checkAuth'); // Add if you want search restricted

// Route for search suggestions
// Apply checkAuth here if needed
router.get('/suggestions', searchController.getSearchSuggestions); 

// Route for full search results
router.get('/', searchController.getFullSearchResults);

module.exports = router;