const nodemailer = require("nodemailer");

/**
 * Email service using SMTP (Gmail / Mailtrap / etc.)
 */

// ============================================
// SMTP TRANSPORTER
// ============================================

let smtpTransporter;

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true", // true untuk 465, false untuk 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // penting untuk VPS / Docker
      },
      logger: true,
      debug: true,
    });
  }
  return smtpTransporter;
};

// ============================================
// SEND EMAIL CORE
// ============================================

const sendViaSmtp = async (to, subject, html) => {
  const from = `"NutriGrow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

  await getSmtpTransporter().sendMail({
    from,
    to,
    subject,
    html,
  });
};

const sendEmail = async (to, subject, html) => {
  try {
    await sendViaSmtp(to, subject, html);
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    throw new Error("Gagal mengirim email");
  }
};

// ============================================
// EMAIL: VERIFICATION
// ============================================

const sendVerificationEmail = async (to, verificationToken) => {
  const verifyUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/verify-email?token=${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2d7a4f; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🌿 NutriGrow</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #eee;">
        <h2>Verifikasi Email Kamu</h2>
        <p>Klik tombol di bawah untuk verifikasi:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background:#2d7a4f;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Verifikasi Email
          </a>
        </div>
        <p>Atau buka link ini:</p>
        <p>${verifyUrl}</p>
      </div>
    </div>
  `;

  await sendEmail(to, "Verifikasi Email - NutriGrow", html);
};

// ============================================
// EMAIL: RESET PASSWORD
// ============================================

const sendPasswordResetEmail = async (to, resetToken) => {
  const resetUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2d7a4f; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🌿 NutriGrow</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #eee;">
        <h2>Reset Password</h2>
        <p>Klik tombol di bawah untuk reset password:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background:#2d7a4f;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Reset Password
          </a>
        </div>
        <p>Atau buka link ini:</p>
        <p>${resetUrl}</p>
      </div>
    </div>
  `;

  await sendEmail(to, "Reset Password - NutriGrow", html);
};

// ============================================

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};