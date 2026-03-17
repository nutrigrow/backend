/**
 * Custom API Error class
 * Extends the native Error to include HTTP status codes
 */
class ApiError extends Error {
    constructor(statusCode, message, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message, errors = []) {
        return new ApiError(400, message, errors);
    }

    static unauthorized(message = 'Silakan login terlebih dahulu') {
        return new ApiError(401, message);
    }

    static forbidden(message = 'Anda tidak memiliki akses') {
        return new ApiError(403, message);
    }

    static notFound(message = 'Resource tidak ditemukan') {
        return new ApiError(404, message);
    }

    static conflict(message) {
        return new ApiError(409, message);
    }

    static tooManyRequests(message = 'Terlalu banyak request, coba lagi nanti') {
        return new ApiError(429, message);
    }

    static internal(message = 'Terjadi kesalahan pada server') {
        return new ApiError(500, message);
    }
}

module.exports = ApiError;
