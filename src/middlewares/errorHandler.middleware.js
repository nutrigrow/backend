const ApiError = require("../utils/ApiError");

/**
 * Centralized error handler middleware.
 * All errors thrown in the app eventually reach here.
 */
const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Prisma: Unique constraint violation
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "field";
    error = ApiError.conflict(`${field} sudah digunakan`);
  }

  // Prisma: Record not found
  if (err.code === "P2025") {
    error = ApiError.notFound("Data tidak ditemukan");
  }

  // JWT: Invalid token
  if (err.name === "JsonWebTokenError") {
    error = ApiError.unauthorized("Token tidak valid");
  }

  // JWT: Token expired
  if (err.name === "TokenExpiredError") {
    error = ApiError.unauthorized("Token sudah kadaluarsa");
  }

  // Zod v4: Validation error
  // In Zod v4, issues are stored in err.issues (err.errors was removed)
  if (err.name === "ZodError") {
    const issues = err.issues ?? err.errors ?? [];
    const messages = issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    error = ApiError.badRequest("Validasi gagal", messages);
  }

  const statusCode = error.statusCode || 500;
  const status = error.status || "error";

  const response = {
    status,
    message: error.message || "Terjadi kesalahan pada server",
  };

  // Include validation errors if present
  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = error.stack || err.stack;
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error("💥 Server Error:", err);
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
