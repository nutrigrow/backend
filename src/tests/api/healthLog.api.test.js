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

  it('API-P0-015 GET /api/health-logs/insight requires authentication', async () => {
    const res = await ctx.request.get('/api/health-logs/insight');
    expect(res.status).toBe(401);
    expect(ctx.services.healthLog.getInsight).not.toHaveBeenCalled();
  });

  it('API-P0-015 GET /api/health-logs/insight returns health insight', async () => {
    ctx.services.healthLog.getInsight.mockResolvedValue({ has_log_today: false });
    const res = await ctx.request
      .get('/api/health-logs/insight')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ has_log_today: false, insights: [], field_insights: {} });
    expect(ctx.services.healthLog.getInsight).toHaveBeenCalledWith(7);
  });

  it('API-P0-015 GET /api/health-logs/insight returns the contextual insight list with Card and Detail data', async () => {
    const insight = {
      id: 'low-sleep-and-water',
      fields: ['sleep', 'hydration'],
      category: 'Perlu Diperhatikan',
      status: 'caution',
      title: 'Tidur dan asupan cairan tercatat rendah',
      message: 'Tidur tercatat kurang dari 6 jam pada 3 dari 7 hari terakhir.',
      based_on: ['Rata-rata tidur: 2,7 jam', 'Rata-rata cairan: 3,7 gelas'],
      action: { type: 'consult', label: 'Konsultasi via Tele-Nutrition' },
      disclaimer: 'Informasi berdasarkan catatan pengguna dan bukan diagnosis medis.',
      detail: {
        title: 'Tidur dan asupan cairan tercatat rendah',
        pattern_summary: 'Data tidur dan asupan cairan sama-sama menunjukkan pola yang perlu diperhatikan.',
        period: '7 hari terakhir',
        data_used: ['Periode: 7 hari terakhir', 'Rata-rata tidur: 2,7 jam'],
        history: [{ date: '2026-10-08', label: 'Kamis, 8 Okt', value: '3 jam · 5 gelas', state: 'flag' }],
        reason: 'Insight muncul karena rata-rata tidur 2,7 jam tercatat bersamaan dengan cairan rendah.',
        action_text: 'Lanjutkan pencatatan dan pertimbangkan konsultasi dengan tenaga kesehatan.',
        disclaimer: 'Informasi berdasarkan catatan pengguna dan bukan diagnosis medis.',
      },
    };
    ctx.services.healthLog.getInsight.mockResolvedValue({
      has_log_today: true,
      insights: [insight],
      field_insights: { sleep: insight },
    });
    const res = await ctx.request
      .get('/api/health-logs/insight')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBe(200);
    expect(res.body.data.insights).toEqual([insight]);
    expect(res.body.data.field_insights.sleep.detail.reason).toContain('2,7 jam');
    expect(ctx.services.healthLog.getInsight).toHaveBeenCalledWith(7);
  });

  it('API-P0-015 GET /api/health-logs/insight always returns insights as an array', async () => {
    ctx.services.healthLog.getInsight.mockResolvedValue({ has_log_today: true, insights: null });
    const res = await ctx.request
      .get('/api/health-logs/insight')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.insights)).toBe(true);
    expect(res.body.data.insights).toHaveLength(0);
    expect(res.body.data.field_insights).toEqual({});
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

  it('API-P1-022 DELETE /api/health-logs/:id requires authentication', async () => {
    const res = await ctx.request.delete('/api/health-logs/5');
    expect(res.status).toBe(401);
    expect(ctx.services.healthLog.deleteLog).not.toHaveBeenCalled();
  });

  it('API-P1-022 DELETE /api/health-logs/:id deletes the log of the logged-in user', async () => {
    ctx.services.healthLog.deleteLog.mockResolvedValue({ id: 5 });
    const res = await ctx.request
      .delete('/api/health-logs/5')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5 });
    expect(ctx.services.healthLog.deleteLog).toHaveBeenCalledWith(7, 5);
  });

  it('API-P1-022 DELETE /api/health-logs/:id rejects an invalid id before service call', async () => {
    const res = await ctx.request
      .delete('/api/health-logs/abc')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBe(400);
    expect(ctx.services.healthLog.deleteLog).not.toHaveBeenCalled();
  });
  
  it('API-P1-022 DELETE /api/health-logs/:id returns an error when the log is not found', async () => {
    ctx.services.healthLog.deleteLog.mockRejectedValue(
      ApiError.badRequest('Catatan kesehatan tidak ditemukan'),
    );
    const res = await ctx.request
      .delete('/api/health-logs/999')
      .set('Authorization', bearer(ctx.userToken));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toBe('Catatan kesehatan tidak ditemukan');
  });
});