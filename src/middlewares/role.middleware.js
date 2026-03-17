const ApiError = require('../utils/ApiError');

/**
 * Role-based access control middleware.
 * Restrict access to routes based on user roles.
 *
 * @param  {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/products', authenticate, authorize('ADMIN'), createProduct);
 * router.put('/consultations/:id', authenticate, authorize('AHLI_GIZI'), updateConsultation);
 */
const authorize = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(ApiError.unauthorized());
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                ApiError.forbidden(
                    `Role '${req.user.role}' tidak memiliki akses ke resource ini`
                )
            );
        }

        next();
    };
};

module.exports = { authorize };
