import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../../validators/auth.validator.js');

describe('auth.validator registerSchema', () => {
  it('accepts valid registration and normalizes email/name', () => {
    const result = registerSchema.body.safeParse({
      nama: '  Bunda Test  ',
      email: 'BUNDA@EXAMPLE.COM',
      password: 'Password1',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      nama: 'Bunda Test',
      email: 'bunda@example.com',
      password: 'Password1',
    });
  });

  it('rejects weak password', () => {
    const result = registerSchema.body.safeParse({
      nama: 'Bunda Test',
      email: 'bunda@example.com',
      password: 'password',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['password'],
        }),
      ]),
    );
  });
});

describe('auth.validator login and token schemas', () => {
  it('rejects invalid login email', () => {
    const result = loginSchema.body.safeParse({
      email: 'invalid-email',
      password: 'Password1',
    });

    expect(result.success).toBe(false);
  });

  it('requires refresh token', () => {
    const result = refreshTokenSchema.body.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('auth.validator protected profile schemas', () => {
  it('accepts valid change password payload', () => {
    const result = changePasswordSchema.body.safeParse({
      currentPassword: 'Password1',
      newPassword: 'NewPassword1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects impossible mother height', () => {
    const result = updateProfileSchema.body.safeParse({
      tinggiBadanIbu: 99,
    });

    expect(result.success).toBe(false);
  });
});
