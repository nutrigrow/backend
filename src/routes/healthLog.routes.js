const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createOrUpdateLogSchema } = require('../validators/healthLog.validator');
const healthLogController = require('../controllers/healthLog.controller');

// All routes are protected
router.use(authenticate);

// ============================================
// Health Log CRUD
// ============================================

// POST /api/health-logs — create or update a log entry
router.post('/', validate(createOrUpdateLogSchema), healthLogController.createOrUpdateLog);

// GET /api/health-logs/today — get today's log (must come before GET /)
router.get('/today', healthLogController.getTodayLog);

// GET /api/health-logs/insight — get health insight summary
router.get('/insight', healthLogController.getInsight);

// GET /api/health-logs/notifications — get notification items
router.get('/notifications', healthLogController.getNotifications);

// GET /api/health-logs — get all logs (newest first)
router.get('/', healthLogController.getAllLogs);

module.exports = router;
