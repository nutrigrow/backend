const express = require('express');
const router = express.Router();

// Import route modules
// const userRoutes = require('./userRoutes');

// Mount routes
// router.use('/users', userRoutes);

// Example route
router.get('/hello', (req, res) => {
    res.json({
        status: 'success',
        message: 'Hello from NutriGrow API! 👋',
    });
});

module.exports = router;
