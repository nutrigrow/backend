import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createApiTestContext, ApiError } from '../helpers/apiTestUtils.js';

describe('Reward & Gamification API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  describe('GET /api/rewards/summary', () => {
    it('requires authentication', async () => {
      const res = await ctx.request.get('/api/rewards/summary');
      expect(res.status).toBe(401);
    });

    it('returns reward summary for authenticated user', async () => {
      ctx.services.reward.getRewardSummary.mockResolvedValue({
        points: 750,
        totalEarnedPoints: 1200,
        levelName: 'Konsisten',
        nextLevelName: 'Berdedikasi',
        nextLevelTarget: 1000,
        streakDays: 7,
        streakBonus: 50,
      });

      const res = await ctx.request
        .get('/api/rewards/summary')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.points).toBe(750);
      expect(res.body.data.levelName).toBe('Konsisten');
      expect(ctx.services.reward.getRewardSummary).toHaveBeenCalledWith(7);
    });
  });

  describe('GET /api/rewards/catalog', () => {
    it('returns catalog items', async () => {
      ctx.services.reward.getCatalog.mockResolvedValue([
        { id: 'v-20k', title: 'Voucher 20k', cost: 200 },
      ]);

      const res = await ctx.request
        .get('/api/rewards/catalog')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/rewards/missions', () => {
    it('returns missions status', async () => {
      ctx.services.reward.getMissionsStatus.mockResolvedValue([
        { id: 'log-tb-bb', title: 'Log TB/BB', status: 'action' },
      ]);

      const res = await ctx.request
        .get('/api/rewards/missions')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data[0].id).toBe('log-tb-bb');
    });
  });

  describe('GET /api/rewards/history', () => {
    it('returns point transactions ledger', async () => {
      ctx.services.reward.getPointHistory.mockResolvedValue([
        { id: '1', title: 'Health Log', amount: 10 },
      ]);

      const res = await ctx.request
        .get('/api/rewards/history')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/rewards/redeem', () => {
    it('fails when balance is insufficient', async () => {
      ctx.services.reward.redeemReward.mockRejectedValue(
        ApiError.badRequest('Saldo poin tidak mencukupi')
      );

      const res = await ctx.request
        .post('/api/rewards/redeem')
        .set('Authorization', bearer(ctx.userToken))
        .send({ rewardId: 'tele-1' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Saldo poin tidak mencukupi');
    });

    it('succeeds when balance is sufficient', async () => {
      ctx.services.reward.redeemReward.mockResolvedValue({
        redemptionId: 10,
        reward: 'Voucher NutriShop Rp20.000',
        cost: 200,
        remainingPoints: 550,
      });

      const res = await ctx.request
        .post('/api/rewards/redeem')
        .set('Authorization', bearer(ctx.userToken))
        .send({ rewardId: 'v-20k' });

      expect(res.status).toBe(200);
      expect(res.body.data.remainingPoints).toBe(550);
      expect(ctx.services.reward.redeemReward).toHaveBeenCalledWith(7, 'v-20k');
    });
  });

  describe('POST /api/rewards/read-article/:articleId', () => {
    it('records article read and returns result', async () => {
      ctx.services.reward.recordArticleRead.mockResolvedValue({
        awarded: true,
        pointsAwarded: 5,
        message: 'Berhasil mendapatkan 5 poin',
      });

      const res = await ctx.request
        .post('/api/rewards/read-article/2')
        .set('Authorization', bearer(ctx.userToken));

      expect(res.status).toBe(200);
      expect(res.body.data.pointsAwarded).toBe(5);
      expect(ctx.services.reward.recordArticleRead).toHaveBeenCalledWith(7, '2');
    });
  });
});
