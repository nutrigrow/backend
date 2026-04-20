const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const {
  TOKEN_TYPES,
  TOKEN_EXPIRY,
  BCRYPT_SALT_ROUNDS,
} = require("../utils/constants");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("./email.service");

// ============================================
// TOKEN HELPERS
// ============================================

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @param {string} type - Token type (access, refresh, reset_password, email_verification)
 * @returns {string} Signed JWT
 */
const generateToken = (payload, type) => {
  const expiryMap = {
    [TOKEN_TYPES.ACCESS]: TOKEN_EXPIRY.ACCESS,
    [TOKEN_TYPES.REFRESH]: TOKEN_EXPIRY.REFRESH,
    [TOKEN_TYPES.RESET_PASSWORD]: TOKEN_EXPIRY.RESET_PASSWORD,
    [TOKEN_TYPES.EMAIL_VERIFICATION]: TOKEN_EXPIRY.EMAIL_VERIFICATION,
  };

  const expiresIn = expiryMap[type] ?? TOKEN_EXPIRY.ACCESS;

  return jwt.sign({ ...payload, type }, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate access + refresh token pair for a user
 * @param {Object} user - User object
 * @param {Object} meta - Request metadata (userAgent, ipAddress)
 * @returns {Object} { accessToken, refreshToken }
 */
const generateAuthTokens = async (user, meta = {}) => {
  const accessToken = generateToken(
    { sub: user.id, role: user.role },
    TOKEN_TYPES.ACCESS,
  );

  const refreshTokenRaw = generateToken({ sub: user.id }, TOKEN_TYPES.REFRESH);

  // Hash the refresh token before storing in DB
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshTokenRaw)
    .digest("hex");

  // Store hashed refresh token in database
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });

  return { accessToken, refreshToken: refreshTokenRaw };
};

// ============================================
// AUTH OPERATIONS
// ============================================

/**
 * Register a new user with email and password.
 * Sends a verification email after successful registration.
 */
const register = async ({ nama, email, password }) => {
  // 1. Cek apakah email sudah ada di database utama
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw ApiError.conflict("Email sudah terdaftar");
  }

  // 2. Hash password SEBELUM dimasukkan ke token
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // 3. Masukkan data pendaftaran ke dalam JWT Payload (Stateless)
  const payload = {
    nama,
    email,
    passwordHash
  };

  // 4. Generate token verifikasi (berisi data user)
  const verificationToken = generateToken(
    payload,
    TOKEN_TYPES.EMAIL_VERIFICATION,
  );

  // 5. Kirim email
  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (emailError) {
    console.warn("⚠️  [Auth] Gagal mengirim email verifikasi ke", email, emailError.message);
    throw ApiError.internal("Gagal mengirim email verifikasi. Pastikan konfigurasi email benar.");
  }

  // Perhatikan: Kita TIDAK memanggil prisma.user.create di sini!
  return null; 
};

/**
 * Login with email and password.
 * Requires email to be verified before granting access.
 */
const login = async ({ email, password }, meta = {}) => {
  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized("Email atau password salah");
  }

  // Check if user has a password (might be Google-only account)
  if (!user.passwordHash) {
    throw ApiError.unauthorized(
      "Akun ini terdaftar melalui Google. Silakan login dengan Google.",
    );
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw ApiError.unauthorized("Email atau password salah");
  }

  // Check if email has been verified.
  // Set REQUIRE_EMAIL_VERIFICATION=true in .env to enforce this in production.
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === "true";
  if (requireVerification && !user.emailVerifiedAt) {
    throw ApiError.forbidden(
      "Email belum diverifikasi. Silakan cek inbox kamu dan klik link verifikasi, " +
        "atau gunakan endpoint /resend-verification untuk mengirim ulang email.",
    );
  }

  // Generate tokens
  const tokens = await generateAuthTokens(user, meta);

  const userData = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };

  return { user: userData, tokens };
};

/**
 * Handle Google OAuth login/register.
 * Called after Passport.js has authenticated the user.
 * Google accounts are considered verified by default.
 */
const googleAuth = async (user, meta = {}) => {
  const tokens = await generateAuthTokens(user, meta);

  const userData = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };

  return { user: userData, tokens };
};

/**
 * Verify a user's email address using the token sent to their email.
 * @param {string} token - The email verification JWT
 */
const verifyEmail = async (token) => {
  // 1. Verifikasi JWT
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw ApiError.badRequest("Token verifikasi tidak valid atau sudah kadaluarsa");
  }

  // 2. Cek tipe token
  if (decoded.type !== TOKEN_TYPES.EMAIL_VERIFICATION) {
    throw ApiError.badRequest("Token type tidak valid");
  }

  // 3. Cek apakah user sudah terlanjur dibuat di database 
  // (misal user klik link verifikasi 2 kali)
  const existingUser = await prisma.user.findUnique({ where: { email: decoded.email } });
  if (existingUser) {
    if (existingUser.emailVerifiedAt) return; // Kalau sudah diverifikasi, diamkan saja (idempotent)
    throw ApiError.badRequest("Email sudah terdaftar");
  }

  // 4. SEKARANG baru kita buat user di database!
  await prisma.user.create({
    data: {
      nama: decoded.nama,
      email: decoded.email,
      passwordHash: decoded.passwordHash,
      emailVerifiedAt: new Date(), // Langsung tandai verified
    },
  });
};

/**
 * Resend the email verification link to the user.
 * Always returns silently to prevent email enumeration attacks.
 * @param {string} email - The user's email address
 */
const resendVerificationEmail = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Silently return if user not found (prevent enumeration)
  if (!user) return;

  // Already verified — nothing to do
  if (user.emailVerifiedAt) return;

  // Google-only accounts don't need email verification
  if (!user.passwordHash && user.googleId) return;

  // Generate a fresh verification token and re-send
  const verificationToken = generateToken(
    { sub: user.id },
    TOKEN_TYPES.EMAIL_VERIFICATION,
  );

  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (emailError) {
    console.warn(
      "⚠️  [Auth] Gagal mengirim ulang email verifikasi ke",
      email,
      "—",
      emailError.message,
    );
    console.warn("   Pastikan konfigurasi SMTP sudah benar di file .env");
  }
};

/**
 * Refresh access token using a valid refresh token.
 * Implements token rotation — old token is revoked and a new pair is issued.
 */
const refreshAccessToken = async (refreshTokenRaw, meta = {}) => {
  // 1. Verify the JWT itself
  let decoded;
  try {
    decoded = jwt.verify(refreshTokenRaw, process.env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized(
      "Refresh token tidak valid atau sudah kadaluarsa",
    );
  }

  if (decoded.type !== TOKEN_TYPES.REFRESH) {
    throw ApiError.unauthorized("Token type tidak valid");
  }

  // 2. Find the hashed token in database
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshTokenRaw)
    .digest("hex");

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!storedToken) {
    throw ApiError.unauthorized(
      "Refresh token tidak valid atau sudah digunakan",
    );
  }

  // 3. Revoke old refresh token (token rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { isRevoked: true },
  });

  // 4. Generate new token pair
  const tokens = await generateAuthTokens(storedToken.user, meta);

  return tokens;
};

/**
 * Logout — revoke the provided refresh token.
 */
const logout = async (refreshTokenRaw) => {
  if (!refreshTokenRaw) return;

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshTokenRaw)
    .digest("hex");

  // Revoke the token (ignore if not found)
  await prisma.refreshToken.updateMany({
    where: { tokenHash, isRevoked: false },
    data: { isRevoked: true },
  });
};

/**
 * Forgot password — generate a reset token and send it via email.
 * Always returns silently to prevent email enumeration attacks.
 */
const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration attacks
  if (!user) return;

  // Don't send reset for Google-only accounts
  if (!user.passwordHash && user.googleId) return;

  // Generate reset token
  const resetToken = generateToken(
    { sub: user.id },
    TOKEN_TYPES.RESET_PASSWORD,
  );

  // Send email
  await sendPasswordResetEmail(email, resetToken);
};

/**
 * Reset password using the token sent to the user's email.
 * Also revokes all active refresh tokens to force re-login everywhere.
 */
const resetPassword = async (token, newPassword) => {
  // Verify reset token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw ApiError.badRequest("Token tidak valid atau sudah kadaluarsa");
  }

  if (decoded.type !== TOKEN_TYPES.RESET_PASSWORD) {
    throw ApiError.badRequest("Token type tidak valid");
  }

  // Find user
  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Revoke all existing refresh tokens (force re-login everywhere)
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, isRevoked: false },
    data: { isRevoked: true },
  });
};

/**
 * Change password for an authenticated user.
 * Verifies the current password before applying the change.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user.passwordHash) {
    throw ApiError.badRequest(
      "Akun ini terdaftar melalui Google. Atur password baru melalui menu Forgot Password.",
    );
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw ApiError.unauthorized("Password lama salah");
  }

  // Hash and update new password
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

/**
 * Get the profile of the currently authenticated user.
 */
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      googleId: true,
      tinggiBadanIbu: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw ApiError.notFound("User tidak ditemukan");
  }

  // Don't expose googleId directly, just indicate whether it's linked
  return {
    ...user,
    googleId: undefined,
    isGoogleLinked: !!user.googleId,
  };
};

/**
 * Update the profile of the currently authenticated user.
 * @param {number} userId - The user ID
 * @param {Object} updateData - Data to update (nama, tinggiBadanIbu)
 */
const updateMe = async (userId, updateData) => {
  // Filter allowed fields
  const allowedUpdates = ["nama", "tinggiBadanIbu"];
  const finalData = {};

  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      finalData[key] = updateData[key];
    }
  });

  if (Object.keys(finalData).length === 0) {
    throw ApiError.badRequest("Tidak ada data valid yang dikirim untuk diupdate");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: finalData,
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      avatarUrl: true,
      tinggiBadanIbu: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

module.exports = {
  register,
  login,
  googleAuth,
  verifyEmail,
  resendVerificationEmail,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateMe,
  generateAuthTokens,
};
