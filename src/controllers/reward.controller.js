const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/responseHelper');
const rewardService = require('../services/reward.service');

const getSummary = catchAsync(async (req, res) => {
  const data = await rewardService.getRewardSummary(req.user.id);
  success(res, {
    message: 'Ringkasan reward berhasil diambil',
    data,
  });
});

const getCatalog = catchAsync(async (req, res) => {
  const data = await rewardService.getCatalog();
  success(res, {
    message: 'Katalog reward berhasil diambil',
    data,
  });
});

const getMissions = catchAsync(async (req, res) => {
  const data = await rewardService.getMissionsStatus(req.user.id);
  success(res, {
    message: 'Daftar misi berhasil diambil',
    data,
  });
});

const getHistory = catchAsync(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const data = await rewardService.getPointHistory(req.user.id, limit);
  success(res, {
    message: 'Riwayat transaksi poin berhasil diambil',
    data,
  });
});

const redeem = catchAsync(async (req, res) => {
  const { rewardId } = req.body;
  const data = await rewardService.redeemReward(req.user.id, rewardId);
  success(res, {
    message: `Berhasil menukar reward "${data.reward}"`,
    data,
  });
});

const readArticle = catchAsync(async (req, res) => {
  const { articleId } = req.params;
  const data = await rewardService.recordArticleRead(req.user.id, articleId);
  success(res, {
    message: data.message,
    data,
  });
});

module.exports = {
  getSummary,
  getCatalog,
  getMissions,
  getHistory,
  redeem,
  readArticle,
};
