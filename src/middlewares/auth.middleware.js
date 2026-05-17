const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/database');
const { TOKEN_TYPES } = require('../utils/constants');

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the authenticated user to req.user.
 */
const authenticate = async (req, _res, next) => {
    try {
        // 1. Extract token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw ApiError.unauthorized('Token tidak ditemukan');
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Check token type
        if (decoded.type !== TOKEN_TYPES.ACCESS) {
            throw ApiError.unauthorized('Token type tidak valid');
        }

        // 4. Find user in database (ensure user still exists)
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: {
                id: true,
                nama: true,
                email: true,
                role: true,
                avatarUrl: true,
                isActive: true,
                deletedAt: true,
                emailVerifiedAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw ApiError.unauthorized('User tidak ditemukan');
        }

        if (!user.isActive || user.deletedAt) {
            throw ApiError.forbidden('Akun tidak aktif');
        }

        // 5. Attach user to request
        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional authentication — same as authenticate but doesn't throw
 * if no token is present. Useful for endpoints that work differently
 * for logged-in vs anonymous users.
 */
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type === TOKEN_TYPES.ACCESS) {
            const user = await prisma.user.findUnique({
                where: { id: decoded.sub },
                select: {
                    id: true,
                    nama: true,
                    email: true,
                    role: true,
                    avatarUrl: true,
                    isActive: true,
                    deletedAt: true,
                },
            });
            req.user = user && user.isActive && !user.deletedAt ? user : null;
        }

        next();
    } catch {
        // Token invalid/expired — just continue without user
        next();
    }
};

module.exports = { authenticate, optionalAuth };
