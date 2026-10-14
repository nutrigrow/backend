const express = require("express");
const router = express.Router();
const consultationController = require("../controllers/consultation.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");

router.use(authenticate);

router.get("/availability/:specialistId", consultationController.getAvailability);
router.post("/book", consultationController.createBooking);
router.get("/me", consultationController.getMyConsultations);
router.patch("/:id/reschedule", consultationController.reschedule);
router.patch("/:id/cancel", consultationController.cancel);
router.patch("/:id/confirm-payment", consultationController.confirmPayment);

// PPL II: Nutritionist endpoints
router.get(
  "/nutritionist/consultations/:consultationId/user-summary",
  authorize("AHLI_GIZI"),
  consultationController.getConsultationUserSummary
);
router.post(
  "/nutritionist/consultations/:consultationId/follow-up",
  authorize("AHLI_GIZI"),
  consultationController.createFollowUp
);

// PPL II: User endpoint
router.get(
  "/user/consultations/:consultationId/follow-up",
  authorize("USER"),
  consultationController.getUserFollowUp
);

module.exports = router;
