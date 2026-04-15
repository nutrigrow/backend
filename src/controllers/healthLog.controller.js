const catchAsync = require('../utils/catchAsync');
const { success, created } = require('../utils/responseHelper');
const healthLogService = require('../services/healthLog.service');

/**
 * @desc  Create or update today's health log
 * @route POST /api/health-logs
 */
const createOrUpdateLog = catchAsync(async (req, res) => {
  const data = await healthLogService.createOrUpdateLog(req.user.id, req.body);
  created(res, { message: 'Log kesehatan berhasil disimpan', data });
});

/**
 * @desc  Get today's health log for the logged-in user
 * @route GET /api/health-logs/today
 */
const getTodayLog = catchAsync(async (req, res) => {
  const data = await healthLogService.getTodayLog(req.user.id);
  success(res, { message: data ? 'Berhasil mengambil log hari ini' : 'Belum ada log hari ini', data });
});

/**
 * @desc  Get all health logs for the logged-in user
 * @route GET /api/health-logs
 */
const getAllLogs = catchAsync(async (req, res) => {
  const data = await healthLogService.getAllLogs(req.user.id);
  success(res, { message: 'Berhasil mengambil semua log kesehatan', data });
});

/**
 * @desc  Get health insight for the logged-in user
 * @route GET /api/health-logs/insight
 */
const getInsight = catchAsync(async (req, res) => {
  const data = await healthLogService.getInsight(req.user.id);
  success(res, { message: 'Berhasil mengambil insight kesehatan', data });
});

/**
 * @desc  Get notifications for the logged-in user
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
  getInsight,
  getNotifications,
};
