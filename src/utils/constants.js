/**
 * Application-wide constants and enums
 */

const ROLES = Object.freeze({
  USER: "USER",
  AHLI_GIZI: "AHLI_GIZI",
  ADMIN: "ADMIN",
});

const TOKEN_TYPES = Object.freeze({
  ACCESS: "access",
  REFRESH: "refresh",
  RESET_PASSWORD: "reset_password",
  EMAIL_VERIFICATION: "email_verification",
});

// Token expiry durations
const TOKEN_EXPIRY = Object.freeze({
  ACCESS: "30m", // 30 minutes
  REFRESH: "7d", // 7 days
  RESET_PASSWORD: "1h", // 1 hour
  EMAIL_VERIFICATION: "24h", // 24 hours
});

const BCRYPT_SALT_ROUNDS = 12;

module.exports = {
  ROLES,
  TOKEN_TYPES,
  TOKEN_EXPIRY,
  BCRYPT_SALT_ROUNDS,
};
