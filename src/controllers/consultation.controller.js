const catchAsync = require("../utils/catchAsync");
const { success, created } = require("../utils/responseHelper");
const consultationService = require("../services/consultation.service");

/**
 * @desc    Get availability for a specialist
 * @route   GET /api/consultations/availability/:specialistId
 * @access  Private
 */
const getAvailability = catchAsync(async (req, res) => {
  const { date } = req.query;
  const { specialistId } = req.params;
  const result = await consultationService.getAvailability(specialistId, date);

  success(res, {
    message: "Data ketersediaan berhasil diambil",
    data: result,
  });
});

/**
 * @desc    Create a new booking
 * @route   POST /api/consultations/book
 * @access  Private
 */
const createBooking = catchAsync(async (req, res) => {
  const result = await consultationService.createBooking(req.user.id, req.body);

  created(res, {
    message: "Booking berhasil dibuat",
    data: result,
  });
});

/**
 * @desc    Get user's consultations
 * @route   GET /api/consultations/me
 * @access  Private
 */
const getMyConsultations = catchAsync(async (req, res) => {
  const result = await consultationService.getMyConsultations(req.user.id);

  success(res, {
    message: "Daftar konsultasi berhasil diambil",
    data: result,
  });
});

/**
 * @desc    Reschedule consultation
 * @route   PATCH /api/consultations/:id/reschedule
 * @access  Private
 */
const reschedule = catchAsync(async (req, res) => {
  const { newJadwalSesi } = req.body;
  const result = await consultationService.reschedule(req.params.id, req.user.id, newJadwalSesi);

  success(res, {
    message: "Konsultasi berhasil dijadwalkan ulang",
    data: result,
  });
});

/**
 * @desc    Cancel consultation
 * @route   PATCH /api/consultations/:id/cancel
 * @access  Private
 */
const cancel = catchAsync(async (req, res) => {
  const { reason } = req.body;
  const result = await consultationService.cancel(req.params.id, req.user.id, reason);

  success(res, {
    message: "Konsultasi berhasil dibatalkan",
    data: result,
  });
});

/**
 * @desc    Confirm payment — update konsultasi to CONFIRMED after Midtrans success
 * @route   PATCH /api/consultations/:id/confirm-payment
 * @access  Private
 */
const confirmPayment = catchAsync(async (req, res) => {
  const result = await consultationService.confirmPayment(req.params.id, req.user.id);

  success(res, {
    message: "Pembayaran berhasil dikonfirmasi",
    data: result,
  });
});

module.exports = {
  getAvailability,
  createBooking,
  getMyConsultations,
  reschedule,
  cancel,
  confirmPayment,
};
