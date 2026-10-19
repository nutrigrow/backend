import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, bearer, createApiTestContext } from '../helpers/apiTestUtils.js';

describe('Tele Nutritionist API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P1-022 GET /api/specialists returns public specialist list with filters', async () => {
    ctx.services.specialist.getAllSpecialists.mockResolvedValue({
      data: [{ id: 1, nama: 'Dr. Gizi' }],
      pagination: { page: 1 },
    });

    const res = await ctx.request
      .get('/api/specialists')
      .query({ search: 'gizi', category: 'anak', page: '1', limit: '9' });

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(ctx.services.specialist.getAllSpecialists).toHaveBeenCalledWith(
      { search: 'gizi', category: 'anak' },
      { page: '1', limit: '9' },
    );
  });

  it('API-P1-023 GET /api/specialists/:id returns public specialist detail', async () => {
    ctx.services.specialist.getSpecialistById.mockResolvedValue({ id: 1, nama: 'Dr. Gizi' });

    const res = await ctx.request.get('/api/specialists/1');

    expect(res.status).toBe(200);
    expect(res.body.data.specialist).toEqual({ id: 1, nama: 'Dr. Gizi' });
    expect(ctx.services.specialist.getSpecialistById).toHaveBeenCalledWith('1');
  });

  it('API-P1-024 GET /api/consultations/availability/:specialistId requires authentication', async () => {
    const res = await ctx.request.get('/api/consultations/availability/1').query({
      date: '2026-05-25',
    });

    expect(res.status).toBe(401);
    expect(ctx.services.consultation.getAvailability).not.toHaveBeenCalled();
  });

  it('API-P1-024 GET /api/consultations/availability/:specialistId returns available slots', async () => {
    ctx.services.consultation.getAvailability.mockResolvedValue([{ time: '09:00', available: true }]);

    const res = await ctx.request
      .get('/api/consultations/availability/1')
      .set('Authorization', bearer(ctx.userToken))
      .query({ date: '2026-05-25' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ time: '09:00', available: true }]);
    expect(ctx.services.consultation.getAvailability).toHaveBeenCalledWith('1', '2026-05-25');
  });

  it('API-P1-025 POST /api/consultations/book creates a valid booking', async () => {
    const payload = {
      specialistId: 1,
      metode: 'VIDEO_CALL',
      jadwalSesi: '2026-06-01T09:00:00.000Z',
    };
    ctx.services.consultation.createBooking.mockResolvedValue({ id: 10, ...payload });

    const res = await ctx.request
      .post('/api/consultations/book')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.consultation.createBooking).toHaveBeenCalledWith(7, payload);
  });

  it('API-P1-025 POST /api/consultations/book rejects slot conflict or past schedule', async () => {
    ctx.services.consultation.createBooking.mockRejectedValue(
      ApiError.conflict('Slot konsultasi sudah terisi'),
    );

    const res = await ctx.request
      .post('/api/consultations/book')
      .set('Authorization', bearer(ctx.userToken))
      .send({
        specialistId: 1,
        metode: 'VIDEO_CALL',
        jadwalSesi: '2026-06-01T09:00:00.000Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Slot konsultasi sudah terisi');
  });

  it('API-P1-026 GET /api/consultations/me returns authenticated user consultations', async () => {
    ctx.services.consultation.getMyConsultations.mockResolvedValue([{ id: 10 }]);

    const res = await ctx.request
      .get('/api/consultations/me')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.consultation.getMyConsultations).toHaveBeenCalledWith(7);
  });

  it('API-P1-027 PATCH /api/consultations/:id/reschedule reschedules owner consultation', async () => {
    ctx.services.consultation.reschedule.mockResolvedValue({ id: 10 });

    const res = await ctx.request
      .patch('/api/consultations/10/reschedule')
      .set('Authorization', bearer(ctx.userToken))
      .send({ newJadwalSesi: '2026-06-02T09:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(ctx.services.consultation.reschedule).toHaveBeenCalledWith(
      '10',
      7,
      '2026-06-02T09:00:00.000Z',
    );
  });

  it('API-P1-028 PATCH /api/consultations/:id/cancel cancels owner consultation', async () => {
    ctx.services.consultation.cancel.mockResolvedValue({ id: 10, status: 'CANCELLED' });

    const res = await ctx.request
      .patch('/api/consultations/10/cancel')
      .set('Authorization', bearer(ctx.userToken))
      .send({ reason: 'Ada jadwal lain' });

    expect(res.status).toBe(200);
    expect(ctx.services.consultation.cancel).toHaveBeenCalledWith('10', 7, 'Ada jadwal lain');
  });

  it('API-P1-029 PATCH /api/consultations/:id/confirm-payment confirms consultation payment', async () => {
    ctx.services.consultation.confirmPayment.mockResolvedValue({ id: 10, status: 'CONFIRMED' });

    const res = await ctx.request
      .patch('/api/consultations/10/confirm-payment')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.consultation.confirmPayment).toHaveBeenCalledWith('10', 7);
  });

  describe('Health Worker Follow-Up & User Summary (PPL II)', () => {
    it('GET /api/consultations/nutritionist/consultations/:id/user-summary forbids USER role', async () => {
      const res = await ctx.request
        .get('/api/consultations/nutritionist/consultations/10/user-summary')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(403);
    });

    it('GET /api/consultations/nutritionist/consultations/:id/user-summary returns summary for AHLI_GIZI', async () => {
      ctx.services.consultation.getConsultationUserSummary.mockResolvedValue({
        consultation_id: '10',
        child_name: 'Budi Test',
        ai_assessment: { risk_level: 'NORMAL', risk_label: 'Pola Pertumbuhan Optimal' },
      });

      const res = await ctx.request
        .get('/api/consultations/nutritionist/consultations/10/user-summary')
        .set('Authorization', bearer(ctx.ahliGiziToken));

      expect(res.status).toBe(200);
      expect(res.body.data.child_name).toBe('Budi Test');
      expect(ctx.services.consultation.getConsultationUserSummary).toHaveBeenCalledWith('10', 15);
    });

    it('POST /api/consultations/nutritionist/consultations/:id/follow-up creates follow-up for AHLI_GIZI', async () => {
      ctx.services.consultation.createFollowUp.mockResolvedValue({
        id: 99,
        createdAt: new Date(),
      });

      const payload = {
        nutrition_status_evaluation: 'Status gizi baik',
        dietary_recommendations: 'Tingkatkan asupan protein hewani',
        next_evaluation_date: '2026-11-19',
        special_notes: 'Cek berat badan rutin',
      };

      const res = await ctx.request
        .post('/api/consultations/nutritionist/consultations/10/follow-up')
        .set('Authorization', bearer(ctx.ahliGiziToken))
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.consultation_id).toBe('10');
      expect(ctx.services.consultation.createFollowUp).toHaveBeenCalledWith('10', 15, payload);
    });

    it('GET /api/consultations/user/consultations/:id/follow-up returns follow-up for USER', async () => {
      ctx.services.consultation.getUserFollowUp.mockResolvedValue({
        follow_up_id: '99',
        consultation_id: '10',
        nutritionist_name: 'Dr. Gizi Test',
        evaluation_summary: {
          status_label: 'Status gizi baik',
          recommendations: 'Tingkatkan asupan protein hewani',
        },
      });

      const res = await ctx.request
        .get('/api/consultations/user/consultations/10/follow-up')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.nutritionist_name).toBe('Dr. Gizi Test');
      expect(ctx.services.consultation.getUserFollowUp).toHaveBeenCalledWith('10', 7);
    });
  });
});
