import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let emailService;

const { nodemailer, transporter } = vi.hoisted(() => ({
  transporter: {
    sendMail: vi.fn(),
  },
  nodemailer: {
    createTransport: vi.fn(),
  },
}));

const loadService = () => {
  const nodemailerPath = require.resolve('nodemailer');
  const servicePath = require.resolve('../../services/email.service');

  delete require.cache[servicePath];
  require.cache[nodemailerPath] = {
    id: nodemailerPath,
    filename: nodemailerPath,
    loaded: true,
    exports: nodemailer,
  };

  emailService = require('../../services/email.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'smtp-user@example.com';
  process.env.SMTP_PASS = 'secret';
  process.env.SMTP_FROM = 'no-reply@example.com';
  process.env.FRONTEND_URL = 'https://app.example.com';
  nodemailer.createTransport.mockReturnValue(transporter);
  transporter.sendMail.mockResolvedValue({ messageId: 'mail-1' });
  loadService();
});

describe('emailService.sendVerificationEmail', () => {
  it('sends verification email with frontend verification link', async () => {
    await emailService.sendVerificationEmail('bunda@example.com', 'verify-token');

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
      }),
    );
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"NutriGrow" <no-reply@example.com>',
        to: 'bunda@example.com',
        subject: 'Verifikasi Email - NutriGrow',
        html: expect.stringContaining('https://app.example.com/verify-email?token=verify-token'),
      }),
    );
  });
});

describe('emailService.sendPasswordResetEmail', () => {
  it('sends reset password email with frontend reset link', async () => {
    await emailService.sendPasswordResetEmail('bunda@example.com', 'reset-token');

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'bunda@example.com',
        subject: 'Reset Password - NutriGrow',
        html: expect.stringContaining('https://app.example.com/reset-password?token=reset-token'),
      }),
    );
  });

  it('wraps SMTP failure with a generic email error', async () => {
    transporter.sendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      emailService.sendPasswordResetEmail('bunda@example.com', 'reset-token'),
    ).rejects.toThrow('Gagal mengirim email');
  });
});

