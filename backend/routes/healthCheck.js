const express = require('express');
const router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint to verify API connectivity
// @access  Public
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
