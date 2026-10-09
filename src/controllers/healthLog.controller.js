const catchAsync = require('../utils/catchAsync');
const { success, created } = require('../utils/responseHelper');
const healthLogService = require('../services/healthLog.service');
const ApiError = require('../utils/ApiError');
/**
 * @desc Create or update today's health log
 * @route POST /api/health-logs
 */
const createOrUpdateLog = catchAsync(async (req, res) => {
  const data = await healthLogService.createOrUpdateLog(req.user.id, req.body);
  created(res, { message: 'Log kesehatan berhasil disimpan', data });
});
/**
 * @desc Get today's health log for the logged-in user
 * @route GET /api/health-logs/today
 */
const getTodayLog = catchAsync(async (req, res) => {
  const data = await healthLogService.getTodayLog(req.user.id);
  success(res, { message: data ? 'Berhasil mengambil log hari ini' : 'Belum ada log hari ini', data });
});
/**
 * @desc Get all health logs for the logged-in user
 * @route GET /api/health-logs
 */
const getAllLogs = catchAsync(async (req, res) => {
  const data = await healthLogService.getAllLogs(req.user.id);
  success(res, { message: 'Berhasil mengambil semua log kesehatan', data });
});
/**
 * @desc Get health insight (Contextual Health Insight cards + per-field insights) for the logged-in user
 * @route GET /api/health-logs/insight
 */
const getInsight = catchAsync(async (req, res) => {
  const result = await healthLogService.getInsight(req.user.id);
  const data = {
    ...result,
    insights: Array.isArray(result?.insights) ? result.insights : [],
    field_insights: result?.field_insights ?? {},
  };
  success(res, { message: 'Berhasil mengambil insight kesehatan', data });
});
/**
 * @desc Delete one health log of the logged-in user
 * @route DELETE /api/health-logs/:id
 */
const deleteLog = catchAsync(async (req, res) => {
  const logId = Number(req.params.id);
  if (!Number.isInteger(logId) || logId <= 0) {
    throw ApiError.badRequest('ID catatan kesehatan tidak valid');
  }
  const data = await healthLogService.deleteLog(req.user.id, logId);
  success(res, { message: 'Catatan kesehatan berhasil dihapus', data });
});

/**
 * @desc Get notifications for the logged-in user
 * @route GET /api/health-logs/notifications
 */
const getNotifications = catchAsync(async (req, res) => {
  const data = await healthLogService.getNotifications(req.user.id);
  success(res, { message: 'Berhasil mengambil notifikasi', data });
});
module.exports = {
  createOrUpdateLog,
  getTodayLog,
  getAllLogs,
  deleteLog,
  getInsight,
  getNotifications,
};