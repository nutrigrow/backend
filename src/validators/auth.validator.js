const { z } = require("zod");

/**
 * Auth validation schemas using Zod
 */

const registerSchema = {
  body: z.object({
    nama: z
      .string({ required_error: "Nama harus diisi" })
      .min(2, "Nama minimal 2 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .trim(),
    email: z
      .string({ required_error: "Email harus diisi" })
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Password harus diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password harus mengandung huruf besar, huruf kecil, dan angka",
      ),
  }),
};

const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email harus diisi" })
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Password harus diisi" })
      .min(1, "Password harus diisi"),
  }),
};

const verifyEmailSchema = {
  query: z.object({
    token: z
      .string({ required_error: "Token verifikasi harus diisi" })
      .min(1, "Token verifikasi harus diisi"),
  }),
};

const resendVerificationSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email harus diisi" })
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),
  }),
};

const refreshTokenSchema = {
  body: z.object({
    refreshToken: z
      .string({ required_error: "Refresh token harus diisi" })
      .min(1, "Refresh token harus diisi"),
  }),
};

const forgotPasswordSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email harus diisi" })
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),
  }),
};

const resetPasswordSchema = {
  body: z.object({
    token: z
      .string({ required_error: "Token harus diisi" })
      .min(1, "Token harus diisi"),
    password: z
      .string({ required_error: "Password baru harus diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password harus mengandung huruf besar, huruf kecil, dan angka",
      ),
  }),
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z
      .string({ required_error: "Password lama harus diisi" })
      .min(1, "Password lama harus diisi"),
    newPassword: z
      .string({ required_error: "Password baru harus diisi" })
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password harus mengandung huruf besar, huruf kecil, dan angka",
      ),
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
