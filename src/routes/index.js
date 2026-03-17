const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');

// Mount route modules
router.use('/auth', authRoutes);

// Health check for API
router.get('/hello', (req, res) => {
    res.json({
        status: 'success',
        message: 'Hello from NutriGrow API!',
    });
});

module.exports = router;
