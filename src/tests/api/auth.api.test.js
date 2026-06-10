import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  bearer,
  createApiTestContext,
  createRefreshToken,
  testUsers,
} from '../helpers/apiTestUtils.js';

describe('Auth API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P1-001 POST /api/auth/register registers a valid user', async () => {
    ctx.services.auth.register.mockResolvedValue(undefined);

    const res = await ctx.request.post('/api/auth/register').send({
      nama: 'Bunda Baru',
      email: 'bunda.baru@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'success' });
    expect(ctx.services.auth.register).toHaveBeenCalledWith({
      nama: 'Bunda Baru',
      email: 'bunda.baru@example.com',
      password: 'Password1',
    });
  });

  it('API-P1-001 POST /api/auth/register rejects weak password before service call', async () => {
    const res = await ctx.request.post('/api/auth/register').send({
      nama: 'Bunda Baru',
      email: 'bunda.baru@example.com',
      password: 'weak',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 'fail', message: 'Validasi gagal' });
    expect(ctx.services.auth.register).not.toHaveBeenCalled();
  });

  it('API-P1-002 POST /api/auth/login returns tokens for valid credentials', async () => {
    ctx.services.auth.login.mockResolvedValue({
      user: { id: 7, email: 'bunda@example.com' },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });

    const res = await ctx.request.post('/api/auth/login').send({
      email: 'bunda@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBe('access-token');
    expect(ctx.services.auth.login).toHaveBeenCalledWith(
      { email: 'bunda@example.com', password: 'Password1' },
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it('API-P1-002 POST /api/auth/login propagates invalid credential errors', async () => {
    ctx.services.auth.login.mockRejectedValue(ApiError.unauthorized('Email atau password salah'));

    const res = await ctx.request.post('/api/auth/login').send({
      email: 'bunda@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: 'fail', message: 'Email atau password salah' });
  });

  it('API-P1-003 GET /api/auth/me rejects missing token', async () => {
    const res = await ctx.request.get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(ctx.services.auth.getMe).not.toHaveBeenCalled();
  });

  it('API-P1-003 GET /api/auth/me rejects refresh token type', async () => {
    const res = await ctx.request
      .get('/api/auth/me')
      .set('Authorization', bearer(createRefreshToken(testUsers.user)));

    expect(res.status).toBe(401);
    expect(ctx.services.auth.getMe).not.toHaveBeenCalled();
  });

  it('API-P1-003 GET /api/auth/me returns authenticated profile', async () => {
    ctx.services.auth.getMe.mockResolvedValue({ id: 7, email: 'bunda@example.com' });

    const res = await ctx.request
      .get('/api/auth/me')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: 7, email: 'bunda@example.com' });
    expect(ctx.services.auth.getMe).toHaveBeenCalledWith(7);
  });

  it('API-P1-004 POST /api/auth/refresh returns a new access token', async () => {
    ctx.services.auth.refreshAccessToken.mockResolvedValue({ accessToken: 'new-access' });

    const res = await ctx.request.post('/api/auth/refresh').send({
      refreshToken: 'refresh-token',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toEqual({ accessToken: 'new-access' });
    expect(ctx.services.auth.refreshAccessToken).toHaveBeenCalledWith(
      'refresh-token',
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it('API-P1-005 POST /api/auth/logout revokes a refresh token', async () => {
    ctx.services.auth.logout.mockResolvedValue(undefined);

    const res = await ctx.request.post('/api/auth/logout').send({
      refreshToken: 'refresh-token',
    });

    expect(res.status).toBe(200);
    expect(ctx.services.auth.logout).toHaveBeenCalledWith('refresh-token');
  });

  it('API-P1-006 POST /api/auth/change-password changes password for authenticated user', async () => {
    ctx.services.auth.changePassword.mockResolvedValue(undefined);

    const res = await ctx.request
      .post('/api/auth/change-password')
      .set('Authorization', bearer(ctx.userToken))
      .send({
        currentPassword: 'Password1',
        newPassword: 'NewPassword1',
      });

    expect(res.status).toBe(200);
    expect(ctx.services.auth.changePassword).toHaveBeenCalledWith(7, 'Password1', 'NewPassword1');
  });

  it('API-P0-016 PATCH /api/auth/me updates mother height', async () => {
    ctx.services.auth.updateMe.mockResolvedValue({ id: 7, tinggiBadanIbu: 158 });

    const res = await ctx.request
      .patch('/api/auth/me')
      .set('Authorization', bearer(ctx.userToken))
      .send({ tinggiBadanIbu: 158 });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: 7, tinggiBadanIbu: 158 });
    expect(ctx.services.auth.updateMe).toHaveBeenCalledWith(7, { tinggiBadanIbu: 158 });
  });

  it('API-P0-016 PATCH /api/auth/me rejects invalid mother height before service call', async () => {
    const res = await ctx.request
      .patch('/api/auth/me')
      .set('Authorization', bearer(ctx.userToken))
      .send({ tinggiBadanIbu: -1 });

    expect(res.status).toBe(400);
    expect(ctx.services.auth.updateMe).not.toHaveBeenCalled();
  });
});
