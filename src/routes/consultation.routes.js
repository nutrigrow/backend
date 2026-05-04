const express = require("express");
const router = express.Router();
const consultationController = require("../controllers/consultation.controller");
const { authenticate } = require("../middlewares/auth.middleware");

// All routes require authentication
router.use(authenticate);

router.get("/availability/:specialistId", consultationController.getAvailability);
router.post("/book", consultationController.createBooking);
router.get("/me", consultationController.getMyConsultations);
router.patch("/:id/reschedule", consultationController.reschedule);
router.patch("/:id/cancel", consultationController.cancel);
router.patch("/:id/confirm-payment", consultationController.confirmPayment);

module.exports = router;
