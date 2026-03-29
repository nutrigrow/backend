const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const hpp = require('hpp');
const path = require('path');
const passport = require('./config/passport');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler.middleware');
//const { globalLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Set security HTTP headers
app.use(helmet());

// Rate limiting
//app.use(globalLimiter);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// CORS configuration
/* app.use(
    cors({
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
); */

// CORS configuration
app.use(
    cors({
        origin: true, // <-- Ini yang diubah agar otomatis mengizinkan origin yang me-request
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// ============================================
// BODY PARSING & LOGGING
// ============================================

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Menyajikan folder static upload
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============================================
// PASSPORT (Google OAuth)
// ============================================

app.use(passport.initialize());

// ============================================
// ROUTES
// ============================================

app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'NutriGrow Backend API is running 🚀',
        version: '1.0.0',
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'fail',
        message: `Route ${req.originalUrl} tidak ditemukan`,
    });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
