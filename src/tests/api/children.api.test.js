import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, bearer, createApiTestContext } from '../helpers/apiTestUtils.js';

describe('Children API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P1-015 GET /api/children requires authentication', async () => {
    const res = await ctx.request.get('/api/children');

    expect(res.status).toBe(401);
    expect(ctx.services.children.getAllChildren).not.toHaveBeenCalled();
  });

  it('API-P1-015 GET /api/children returns authenticated user children', async () => {
    ctx.services.children.getAllChildren.mockResolvedValue([{ id: 1, namaDepan: 'Leo' }]);

    const res = await ctx.request
      .get('/api/children')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 1, namaDepan: 'Leo' }]);
    expect(ctx.services.children.getAllChildren).toHaveBeenCalledWith(7);
  });

  it('API-P0-007 POST /api/children creates a valid child', async () => {
    const payload = {
      namaDepan: 'Leo',
      namaAkhir: 'Nugraha',
      tanggalLahir: '2025-01-01',
      jenisKelamin: 'LAKI_LAKI',
    };
    ctx.services.children.createChild.mockResolvedValue({ id: 1, ...payload });

    const res = await ctx.request
      .post('/api/children')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.children.createChild).toHaveBeenCalledWith(7, payload);
  });

  it('API-P0-007 POST /api/children rejects future birth date from service', async () => {
    ctx.services.children.createChild.mockRejectedValue(
      ApiError.badRequest('Tanggal lahir tidak boleh di masa depan'),
    );

    const res = await ctx.request
      .post('/api/children')
      .set('Authorization', bearer(ctx.userToken))
      .send({
        namaDepan: 'Leo',
        tanggalLahir: '2999-01-01',
        jenisKelamin: 'LAKI_LAKI',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tanggal lahir tidak boleh di masa depan');
  });

  it('API-P1-016 GET /api/children/:id validates child ownership in service', async () => {
    ctx.services.children.getChildById.mockResolvedValue({ id: 1, namaDepan: 'Leo' });

    const res = await ctx.request
      .get('/api/children/1')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.getChildById).toHaveBeenCalledWith(1, 7);
  });

  it('API-P0-008 PUT /api/children/:id updates owner child', async () => {
    const payload = {
      namaDepan: 'Leo',
      namaAkhir: 'Baru',
      tanggalLahir: '2025-01-01',
      jenisKelamin: 'LAKI_LAKI',
    };
    ctx.services.children.updateChild.mockResolvedValue({ id: 1, ...payload });

    const res = await ctx.request
      .put('/api/children/1')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(200);
    expect(ctx.services.children.updateChild).toHaveBeenCalledWith(1, 7, payload);
  });

  it('API-P0-009 DELETE /api/children/:id deletes owner child', async () => {
    ctx.services.children.deleteChild.mockResolvedValue({ id: 1 });

    const res = await ctx.request
      .delete('/api/children/1')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.deleteChild).toHaveBeenCalledWith(1, 7);
  });

  it('API-P0-009 DELETE /api/children/:id rejects another user child from service', async () => {
    ctx.services.children.deleteChild.mockRejectedValue(ApiError.notFound('Anak tidak ditemukan'));

    const res = await ctx.request
      .delete('/api/children/99')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Anak tidak ditemukan');
  });

  it('GET /api/children/:id/name returns child name', async () => {
    ctx.services.children.getChildName.mockResolvedValue({ namaDepan: 'Leo', namaAkhir: null });

    const res = await ctx.request
      .get('/api/children/1/name')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.getChildName).toHaveBeenCalledWith(1, 7);
  });

  it('API-P0-010 POST /api/children/:id/growth creates a valid growth record', async () => {
    const payload = { tinggiBadan: 75, beratBadan: 9.5, tanggalCatat: '2026-01-01' };
    ctx.services.children.createGrowthRecord.mockResolvedValue({ id: 101, ...payload });

    const res = await ctx.request
      .post('/api/children/1/growth')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.children.createGrowthRecord).toHaveBeenCalledWith(1, 7, payload);
  });

  it('API-P0-010 POST /api/children/:id/growth rejects future or duplicate measurement date', async () => {
    ctx.services.children.createGrowthRecord.mockRejectedValue(
      ApiError.badRequest('Pertumbuhan anak pada tanggal ini sudah tercatat'),
    );

    const res = await ctx.request
      .post('/api/children/1/growth')
      .set('Authorization', bearer(ctx.userToken))
      .send({ tinggiBadan: 75, beratBadan: 9.5, tanggalCatat: '2026-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Pertumbuhan anak pada tanggal ini sudah tercatat');
  });

  it('API-P1-017 GET /api/children/:id/growth/latest returns latest growth or null', async () => {
    ctx.services.children.getLatestGrowth.mockResolvedValue({ data: null });

    const res = await ctx.request
      .get('/api/children/1/growth/latest')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.getLatestGrowth).toHaveBeenCalledWith(1, 7);
  });

  it('API-P1-018 GET /api/children/:id/growth/bmi-chart returns BMI chart', async () => {
    ctx.services.children.getBmiChart.mockResolvedValue([]);

    const res = await ctx.request
      .get('/api/children/1/growth/bmi-chart')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.getBmiChart).toHaveBeenCalledWith(1, 7);
  });

  it('API-P1-019 GET /api/children/:id/growth/percentile returns percentile data', async () => {
    ctx.services.children.getPercentile.mockResolvedValue([]);

    const res = await ctx.request
      .get('/api/children/1/growth/percentile')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.getPercentile).toHaveBeenCalledWith(1, 7);
  });

  it('API-P0-011 PUT /api/children/growth/:recordId updates owner growth record', async () => {
    const payload = { tinggiBadan: 76, beratBadan: 9.8, tanggalCatat: '2026-01-02' };
    ctx.services.children.updateGrowthRecord.mockResolvedValue({ id: 101, ...payload });

    const res = await ctx.request
      .put('/api/children/growth/101')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(200);
    expect(ctx.services.children.updateGrowthRecord).toHaveBeenCalledWith(101, 7, payload);
  });

  it('API-P0-012 DELETE /api/children/growth/:recordId deletes owner growth record', async () => {
    ctx.services.children.deleteGrowthRecord.mockResolvedValue({ id: 101 });

    const res = await ctx.request
      .delete('/api/children/growth/101')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.children.deleteGrowthRecord).toHaveBeenCalledWith(101, 7);
  });
});
