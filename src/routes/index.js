const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const nutrishopRoutes = require('./nutrishop.routes');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/', nutrishopRoutes);

// Health check for API
router.get('/hello', (req, res) => {
    res.json({
        status: 'success',
        message: 'Hello from NutriGrow API!',
    });
});

module.exports = router;
