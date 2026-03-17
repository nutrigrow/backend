/**
 * Wraps an async route handler to catch errors and pass them to Express error handler.
 * Eliminates the need for try/catch in every controller.
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = catchAsync;
