const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const rewardController = require('../controllers/reward.controller');

router.use(authenticate);

// GET /api/rewards/summary
router.get('/summary', rewardController.getSummary);

// GET /api/rewards/catalog
router.get('/catalog', rewardController.getCatalog);

// GET /api/rewards/missions
router.get('/missions', rewardController.getMissions);

// GET /api/rewards/history
router.get('/history', rewardController.getHistory);

// POST /api/rewards/redeem
router.post('/redeem', rewardController.redeem);

// POST /api/rewards/read-article/:articleId
router.post('/read-article/:articleId', rewardController.readArticle);

module.exports = router;
