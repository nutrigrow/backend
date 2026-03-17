const nodemailer = require("nodemailer");

/**
 * Email service for sending transactional emails.
 * Supports two modes (auto-detected from .env):
 *
 *  1. Gmail API     — set GMAIL_USER + GMAIL_REFRESH_TOKEN
 *     Emails sent directly via Gmail REST API (uses gmail.send scope).
 *     Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (already in .env).
 *     Run `node scripts/get-gmail-token.js` once to get GMAIL_REFRESH_TOKEN.
 *
 *  2. Regular SMTP  — set SMTP_HOST + SMTP_USER + SMTP_PASS
 *     Works with Mailtrap, Brevo, SendGrid, etc.
 */

// ============================================
// GMAIL API — TOKEN & SEND
// ============================================

/**
 * Exchange the stored refresh token for a fresh access token.
 * @returns {Promise<string>} access token
 */
const getGmailAccessToken = async () => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error(
      "Gagal mendapatkan Gmail access token: " +
        (data.error_description || data.error || JSON.stringify(data)),
    );
  }

  return data.access_token;
};

/**
 * Send an email using the Gmail REST API.
 * Constructs a base64url-encoded RFC 2822 message and POSTs it to Gmail.
 *
 * @param {string} to      - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html    - HTML body
 */
const sendViaGmailApi = async (to, subject, html) => {
  const accessToken = await getGmailAccessToken();

  const from = `"NutriGrow" <${process.env.GMAIL_USER}>`;

  // Build a minimal RFC 2822 message
  const rawMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  // Gmail API requires base64url encoding (no +, /, = padding)
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      "Gmail API error: " + (err.error?.message || res.statusText),
    );
  }
};

// ============================================
// REGULAR SMTP (Mailtrap / Brevo / etc.)
// ============================================

let smtpTransporter;

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  return smtpTransporter;
};

const sendViaSmtp = async (to, subject, html) => {
  const from = `"NutriGrow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  await getSmtpTransporter().sendMail({ from, to, subject, html });
};

// ============================================
// UNIFIED SEND FUNCTION
// ============================================

/**
 * Send an email using whichever transport is configured.
 * Gmail API is preferred when GMAIL_USER + GMAIL_REFRESH_TOKEN are set.
 */
const sendEmail = async (to, subject, html) => {
  const useGmailApi = process.env.GMAIL_USER && process.env.GMAIL_REFRESH_TOKEN;

  if (useGmailApi) {
    await sendViaGmailApi(to, subject, html);
  } else {
    await sendViaSmtp(to, subject, html);
  }
};

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Send email verification email.
 * @param {string} to                - Recipient email
 * @param {string} verificationToken - Email verification JWT token
 */
const sendVerificationEmail = async (to, verificationToken) => {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2d7a4f; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🌿 NutriGrow</h1>
        <p style="color: #d4edda; margin: 8px 0 0 0; font-size: 14px;">Platform Deteksi Dini Stunting</p>
      </div>
      <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e8e8e8; border-top: none;">
        <h2 style="color: #2d7a4f; margin-top: 0;">✅ Verifikasi Email Kamu</h2>
        <p style="color: #333; line-height: 1.6;">Hai,</p>
        <p style="color: #333; line-height: 1.6;">
          Terima kasih telah mendaftar di <strong>NutriGrow</strong>!
          Satu langkah lagi untuk mengaktifkan akun kamu.
        </p>
        <p style="color: #333; line-height: 1.6;">
          Klik tombol di bawah ini untuk memverifikasi alamat email kamu:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}"
             style="background-color: #2d7a4f; color: white; padding: 14px 36px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;
                    font-size: 16px; display: inline-block;">
            Verifikasi Email
          </a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Atau salin dan tempel link berikut di browser kamu:
        </p>
        <p style="background-color: #f5f5f5; padding: 12px; border-radius: 4px;
                   word-break: break-all; font-size: 13px; color: #555;">
          ${verifyUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 13px; line-height: 1.6;">
          ⏰ Link ini akan kadaluarsa dalam <strong>24 jam</strong>.<br>
          Jika kamu tidak merasa mendaftar di NutriGrow, abaikan email ini.
        </p>
      </div>
      <div style="background-color: #f9f9f9; padding: 16px; border-radius: 0 0 8px 8px;
                   text-align: center; border: 1px solid #e8e8e8; border-top: none;">
        <p style="color: #aaa; font-size: 12px; margin: 0;">
          © NutriGrow - Platform Deteksi Dini Stunting
        </p>
      </div>
    </div>
  `;

  await sendEmail(to, "Verifikasi Email Kamu - NutriGrow", html);
};

/**
 * Send password reset email.
 * @param {string} to         - Recipient email
 * @param {string} resetToken - Password reset JWT token
 */
const sendPasswordResetEmail = async (to, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2d7a4f; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🌿 NutriGrow</h1>
        <p style="color: #d4edda; margin: 8px 0 0 0; font-size: 14px;">Platform Deteksi Dini Stunting</p>
      </div>
      <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e8e8e8; border-top: none;">
        <h2 style="color: #2d7a4f; margin-top: 0;">🔒 Reset Password</h2>
        <p style="color: #333; line-height: 1.6;">Hai,</p>
        <p style="color: #333; line-height: 1.6;">
          Kami menerima permintaan untuk mereset password akun <strong>NutriGrow</strong> kamu.
        </p>
        <p style="color: #333; line-height: 1.6;">
          Klik tombol di bawah ini untuk membuat password baru:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #2d7a4f; color: white; padding: 14px 36px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;
                    font-size: 16px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Atau salin dan tempel link berikut di browser kamu:
        </p>
        <p style="background-color: #f5f5f5; padding: 12px; border-radius: 4px;
                   word-break: break-all; font-size: 13px; color: #555;">
          ${resetUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 13px; line-height: 1.6;">
          ⏰ Link ini akan kadaluarsa dalam <strong>1 jam</strong>.<br>
          Jika kamu tidak merasa meminta reset password, abaikan email ini.
        </p>
      </div>
      <div style="background-color: #f9f9f9; padding: 16px; border-radius: 0 0 8px 8px;
                   text-align: center; border: 1px solid #e8e8e8; border-top: none;">
        <p style="color: #aaa; font-size: 12px; margin: 0;">
          © NutriGrow - Platform Deteksi Dini Stunting
        </p>
      </div>
    </div>
  `;

  await sendEmail(to, "Reset Password - NutriGrow", html);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
