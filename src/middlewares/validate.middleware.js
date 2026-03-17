const ApiError = require("../utils/ApiError");

/**
 * Request validation middleware using Zod schemas.
 * Validates body, params, and/or query against the provided schema.
 *
 * Compatible with Zod v4 (uses error.issues instead of error.errors).
 *
 * @param {Object} schema - Zod schema object with optional body, params, query keys
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/register', validate(registerSchema), register);
 */
const validate = (schema) => {
  return (req, _res, next) => {
    const errors = [];

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        // Zod v4 uses .issues; fall back to .errors for v3 compatibility
        const issues = result.error.issues ?? result.error.errors ?? [];
        errors.push(
          ...issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            location: "body",
          })),
        );
      } else {
        req.body = result.data; // Use parsed/transformed data
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        errors.push(
          ...issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            location: "params",
          })),
        );
      } else {
        req.params = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        errors.push(
          ...issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            location: "query",
          })),
        );
      } else {
        req.query = result.data;
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest("Validasi gagal", errors));
    }

    next();
  };
};

module.exports = validate;
