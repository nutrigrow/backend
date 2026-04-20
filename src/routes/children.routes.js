const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const childrenController = require('../controllers/children.controller');

// All routes are protected
router.use(authenticate);

// ============================================
// A. Child Profile Management
// ============================================
router.get('/', childrenController.getAllChildren);
router.post('/', childrenController.createChild);
router.get('/:id', childrenController.getChildById);
router.put('/:id', childrenController.updateChild);

// ============================================
// B. Growth Tracker Input
// ============================================
router.get('/:id/name', childrenController.getChildName);
router.post('/:id/growth', childrenController.createGrowthRecord);

// ============================================
// C. Dashboard — Latest Growth
// ============================================
router.get('/:id/growth/latest', childrenController.getLatestGrowth);

// ============================================
// D. BMI Chart vs WHO
// ============================================
router.get('/:id/growth/bmi-chart', childrenController.getBmiChart);

// ============================================
// E. Growth Percentile
// ============================================
router.get('/:id/growth/percentile', childrenController.getPercentile);
router.put('/growth/:recordId', childrenController.updateGrowthRecord);
router.delete('/growth/:recordId', childrenController.deleteGrowthRecord);

module.exports = router;
