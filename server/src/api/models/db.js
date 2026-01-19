const { Pool } = require('pg');
const config = require('../../config');

const pool = new Pool({
    // Use individual environment variables for a more robust connection
    ...config.db,
});

pool.on('connect', () => {
    console.log('Connected to the database!');
});

module.exports = pool;