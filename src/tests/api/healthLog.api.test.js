import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, bearer, createApiTestContext } from '../helpers/apiTestUtils.js';

const validTeenPayload = {
  date: '2026-05-25',
  profile_type: 'teen',
  water_glasses: 8,
  sleep_hours: 7.5,
  took_supplement: true,
  mood: 4,
  is_menstruating: false,
};

describe('Health Log API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P1-020 GET /api/health-logs requires authentication', async () => {
    const res = await ctx.request.get('/api/health-logs');

    expect(res.status).toBe(401);
    expect(ctx.services.healthLog.getAllLogs).not.toHaveBeenCalled();
  });

  it('API-P0-013 POST /api/health-logs creates or updates a valid log', async () => {
    ctx.services.healthLog.createOrUpdateLog.mockResolvedValue({ id: 1, ...validTeenPayload });

    const res = await ctx.request
      .post('/api/health-logs')
      .set('Authorization', bearer(ctx.userToken))
      .send(validTeenPayload);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 1, profile_type: 'teen' });
    expect(ctx.services.healthLog.createOrUpdateLog).toHaveBeenCalledWith(7, validTeenPayload);
  });

  it('API-P0-013 POST /api/health-logs rejects invalid conditional fields before service call', async () => {
    const { is_menstruating: _unused, ...payload } = validTeenPayload;

    const res = await ctx.request
      .post('/api/health-logs')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(400);
    expect(ctx.services.healthLog.createOrUpdateLog).not.toHaveBeenCalled();
  });

  it('API-P0-013 POST /api/health-logs rejects future date from service', async () => {
    ctx.services.healthLog.createOrUpdateLog.mockRejectedValue(
      ApiError.badRequest('Tanggal catatan kesehatan tidak boleh di masa depan'),
    );

    const res = await ctx.request
      .post('/api/health-logs')
      .set('Authorization', bearer(ctx.userToken))
      .send({ ...validTeenPayload, date: '2999-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tanggal catatan kesehatan tidak boleh di masa depan');
  });

  it('API-P0-013 POST /api/health-logs rejects duplicate same-day input without edit mode', async () => {
    ctx.services.healthLog.createOrUpdateLog.mockRejectedValue(
      ApiError.badRequest('Anda sudah memasukkan entry untuk hari ini.'),
    );

    const res = await ctx.request
      .post('/api/health-logs')
      .set('Authorization', bearer(ctx.userToken))
      .send(validTeenPayload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Anda sudah memasukkan entry untuk hari ini.');
  });

  it('API-P0-014 GET /api/health-logs/today returns today log or null', async () => {
    ctx.services.healthLog.getTodayLog.mockResolvedValue(null);

    const res = await ctx.request
      .get('/api/health-logs/today')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('data');
    expect(ctx.services.healthLog.getTodayLog).toHaveBeenCalledWith(7);
  });

  it('API-P0-015 GET /api/health-logs/insight returns health insight', async () => {
    ctx.services.healthLog.getInsight.mockResolvedValue({ has_log_today: false });

    const res = await ctx.request
      .get('/api/health-logs/insight')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ has_log_today: false });
    expect(ctx.services.healthLog.getInsight).toHaveBeenCalledWith(7);
  });

  it('API-P1-021 GET /api/health-logs/notifications returns notification items', async () => {
    ctx.services.healthLog.getNotifications.mockResolvedValue([{ type: 'daily_check' }]);

    const res = await ctx.request
      .get('/api/health-logs/notifications')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ type: 'daily_check' }]);
    expect(ctx.services.healthLog.getNotifications).toHaveBeenCalledWith(7);
  });

  it('API-P1-020 GET /api/health-logs returns authenticated user logs', async () => {
    ctx.services.healthLog.getAllLogs.mockResolvedValue([{ id: 1 }]);

    const res = await ctx.request
      .get('/api/health-logs')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 1 }]);
    expect(ctx.services.healthLog.getAllLogs).toHaveBeenCalledWith(7);
  });
});
