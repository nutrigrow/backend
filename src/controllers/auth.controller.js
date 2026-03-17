const catchAsync = require("../utils/catchAsync");
const { success, created } = require("../utils/responseHelper");
const authService = require("../services/auth.service");

/**
 * @desc    Register new user with email and password
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = catchAsync(async (req, res) => {
  await authService.register(req.body);

  created(res, {
    message: "Registrasi berhasil diterima. Silakan cek inbox/spam email kamu untuk menyelesaikan pendaftaran.",
  });
});

/**
 * @desc    Login with email and password
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = catchAsync(async (req, res) => {
  const meta = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };

  const result = await authService.login(req.body, meta);

  success(res, {
    message: "Login berhasil",
    data: result,
  });
});

/**
 * @desc    Verify email address using token from email link
 * @route   GET /api/auth/verify-email?token=xxx
 * @access  Public
 */
const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);

  success(res, {
    message: "Email berhasil diverifikasi. Selamat datang di NutriGrow!",
  });
});

/**
 * @desc    Initiate Google OAuth login
 * @route   GET /api/auth/google
 * @access  Public
 */
// Handled by Passport middleware in routes

/**
 * @desc    Google OAuth callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
const googleCallback = catchAsync(async (req, res) => {
  const meta = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };

  const result = await authService.googleAuth(req.user, meta);

  // Redirect to frontend with tokens as query params
  // In production, consider using a short-lived code or setting httpOnly cookie instead
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const redirectUrl = new URL("/auth/callback", frontendUrl);
  redirectUrl.searchParams.set("accessToken", result.tokens.accessToken);
  redirectUrl.searchParams.set("refreshToken", result.tokens.refreshToken);

  res.redirect(redirectUrl.toString());
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public (requires valid refresh token)
 */
const refresh = catchAsync(async (req, res) => {
  const meta = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };

  const tokens = await authService.refreshAccessToken(
    req.body.refreshToken,
    meta,
  );

  success(res, {
    message: "Token berhasil diperbarui",
    data: { tokens },
  });
});

/**
 * @desc    Logout (revoke refresh token)
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);

  success(res, { message: "Logout berhasil" });
});

/**
 * @desc    Request password reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);

  // Always return success to prevent email enumeration
  success(res, {
    message: "Jika email terdaftar, link reset password telah dikirim",
  });
});

/**
 * @desc    Reset password using token from email
 * @route   POST /api/auth/reset-password
 * @access  Public (requires valid reset token)
 */
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);

  success(res, {
    message: "Password berhasil direset. Silakan login kembali.",
  });
});

/**
 * @desc    Change password (for logged-in users)
 * @route   POST /api/auth/change-password
 * @access  Private
 */
const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword,
  );

  success(res, { message: "Password berhasil diubah" });
});

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user.id);

  success(res, {
    message: "Data user berhasil diambil",
    data: { user },
  });
});

module.exports = {
  register,
  login,
  verifyEmail,
  googleCallback,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};
