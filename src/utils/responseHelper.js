/**
 * Standardized API response helpers.
 * Ensures consistent response format across all endpoints.
 */

const success = (res, { statusCode = 200, message = 'Berhasil', data = null } = {}) => {
    const response = {
        status: 'success',
        message,
    };
    if (data !== null) {
        response.data = data;
    }
    return res.status(statusCode).json(response);
};

const created = (res, { message = 'Berhasil dibuat', data = null } = {}) => {
    return success(res, { statusCode: 201, message, data });
};

const paginated = (res, { message = 'Berhasil', data = [], pagination = {} } = {}) => {
    return res.status(200).json({
        status: 'success',
        message,
        data,
        pagination,
    });
};

module.exports = { success, created, paginated };
