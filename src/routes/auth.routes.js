const express = require("express");
const passport = require("passport");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require("../validators/auth.validator");

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// Rate limit auth routes to prevent brute force
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

router.post("/login", authLimiter, validate(loginSchema), authController.login);

// Email verification
router.get(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail,
);


router.post("/refresh", validate(refreshTokenSchema), authController.refresh);

router.post("/logout", authController.logout);

router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// ============================================
// GOOGLE OAUTH ROUTES
// ============================================

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/error`,
  }),
  authController.googleCallback,
);

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================

router.get("/me", authenticate, authController.getMe);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
