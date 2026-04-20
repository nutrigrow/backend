const catchAsync = require('../utils/catchAsync');
const { success, created } = require('../utils/responseHelper');
const childrenService = require('../services/children.service');

// ============================================
// A. CHILD PROFILE MANAGEMENT
// ============================================

/**
 * @desc  Get all children for the logged-in user
 * @route GET /api/children
 */
const getAllChildren = catchAsync(async (req, res) => {
  const data = await childrenService.getAllChildren(req.user.id);
  success(res, { message: 'Berhasil mengambil data anak', data });
});

/**
 * @desc  Create a new child profile
 * @route POST /api/children
 */
const createChild = catchAsync(async (req, res) => {
  const data = await childrenService.createChild(req.user.id, req.body);
  created(res, { message: 'Profil anak berhasil dibuat', data });
});

/**
 * @desc  Get a single child profile by ID
 * @route GET /api/children/:id
 */
const getChildById = catchAsync(async (req, res) => {
  const data = await childrenService.getChildById(parseInt(req.params.id), req.user.id);
  success(res, { message: 'Berhasil mengambil profil anak', data });
});

/**
 * @desc  Update a child profile
 * @route PUT /api/children/:id
 */
const updateChild = catchAsync(async (req, res) => {
  const data = await childrenService.updateChild(parseInt(req.params.id), req.user.id, req.body);
  success(res, { message: 'Profil anak berhasil diperbarui', data });
});

// ============================================
// B. GROWTH TRACKER INPUT
// ============================================

/**
 * @desc  Get child's name (for form title display)
 * @route GET /api/children/:id/name
 */
const getChildName = catchAsync(async (req, res) => {
  const data = await childrenService.getChildName(parseInt(req.params.id), req.user.id);
  success(res, { message: 'Berhasil mengambil nama anak', data });
});

/**
 * @desc  Add a new growth record
 * @route POST /api/children/:id/growth
 */
const createGrowthRecord = catchAsync(async (req, res) => {
  const data = await childrenService.createGrowthRecord(parseInt(req.params.id), req.user.id, req.body);
  created(res, { message: 'Data pertumbuhan berhasil disimpan', data });
});

// ============================================
// C. GROWTH TRACKER DASHBOARD — LATEST
// ============================================

/**
 * @desc  Get the latest growth record for a child
 * @route GET /api/children/:id/growth/latest
 */
const getLatestGrowth = catchAsync(async (req, res) => {
  const result = await childrenService.getLatestGrowth(parseInt(req.params.id), req.user.id);
  success(res, { message: result.message, data: result.data });
});

// ============================================
// D. BMI CHART VS WHO
// ============================================

/**
 * @desc  Get BMI history chart data compared against WHO standards
 * @route GET /api/children/:id/growth/bmi-chart
 */
const getBmiChart = catchAsync(async (req, res) => {
  const data = await childrenService.getBmiChart(parseInt(req.params.id), req.user.id);
  success(res, { message: 'Berhasil mengambil data BMI chart', data });
});

// ============================================
// E. GROWTH TRACKER PERCENTILE
// ============================================

/**
 * @desc  Get percentile data for height and weight per record
 * @route GET /api/children/:id/growth/percentile
 */
const getPercentile = catchAsync(async (req, res) => {
  const data = await childrenService.getPercentile(parseInt(req.params.id), req.user.id);
  success(res, { message: 'Berhasil mengambil data persentil pertumbuhan', data });
});

/**
 * @desc  Update a growth record
 * @route PUT /api/children/growth/:recordId
 */
const updateGrowthRecord = catchAsync(async (req, res) => {
  const data = await childrenService.updateGrowthRecord(parseInt(req.params.recordId), req.user.id, req.body);
  success(res, { message: 'Data pertumbuhan berhasil diperbarui', data });
});

/**
 * @desc  Delete a growth record
 * @route DELETE /api/children/growth/:recordId
 */
const deleteGrowthRecord = catchAsync(async (req, res) => {
  await childrenService.deleteGrowthRecord(parseInt(req.params.recordId), req.user.id);
  success(res, { message: 'Data pertumbuhan berhasil dihapus' });
});

module.exports = {
  getAllChildren,
  createChild,
  getChildById,
  updateChild,
  getChildName,
  createGrowthRecord,
  updateGrowthRecord,
  deleteGrowthRecord,
  getLatestGrowth,
  getBmiChart,
  getPercentile,
};
