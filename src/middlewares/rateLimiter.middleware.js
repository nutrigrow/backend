const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — applies to all routes.
 * 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Terlalu banyak request dari IP ini, coba lagi setelah 15 menit',
    },
});

/**
 * Auth rate limiter — stricter, applies to login/register/forgot-password.
 * 5 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Terlalu banyak percobaan, coba lagi setelah 15 menit',
    },
});

module.exports = { globalLimiter, authLimiter };
