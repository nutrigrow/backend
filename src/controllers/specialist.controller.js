const catchAsync = require("../utils/catchAsync");
const { success } = require("../utils/responseHelper");
const specialistService = require("../services/specialist.service");

/**
 * @desc    Get all specialists with filtering and pagination
 * @route   GET /api/specialists
 * @access  Public
 */
const getSpecialists = catchAsync(async (req, res) => {
  const { search, category, page, limit } = req.query;
  const result = await specialistService.getAllSpecialists({ search, category }, { page, limit });

  success(res, {
    message: "Daftar spesialis berhasil diambil",
    data: result,
  });
});

/**
 * @desc    Get specialist by ID
 * @route   GET /api/specialists/:id
 * @access  Public
 */
const getSpecialistById = catchAsync(async (req, res) => {
  const specialist = await specialistService.getSpecialistById(req.params.id);

  success(res, {
    message: "Data spesialis berhasil diambil",
    data: { specialist },
  });
});

module.exports = {
  getSpecialists,
  getSpecialistById,
};
