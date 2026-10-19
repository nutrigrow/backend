import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let rewardService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    poinTransaksi: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    penukaranHadiah: {
      create: vi.fn(),
    },
    logKesehatan: {
      findMany: vi.fn(),
    },
    rekamPertumbuhan: {
      count: vi.fn(),
    },
    riwayatBacaArtikel: {
      count: vi.fn(),
      create: vi.fn(),
    },
    konsultasi: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/reward.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  rewardService = require('../../services/reward.service');
};

describe('Reward Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    loadService();
  });

  describe('awardPoints', () => {
    it('awards points when referensiId is new', async () => {
      prisma.poinTransaksi.findFirst.mockResolvedValue(null);
      prisma.poinTransaksi.create.mockResolvedValue({
        id: 1,
        userId: 10,
        jenisAktivitas: 'LOG_PERTUMBUHAN',
        poin: 20,
        deskripsi: 'Log Pertumbuhan',
        referensiId: 'LOG_GROWTH_10_2026-10-19',
      });

      const res = await rewardService.awardPoints(10, {
        jenisAktivitas: 'LOG_PERTUMBUHAN',
        poin: 20,
        deskripsi: 'Log Pertumbuhan',
        referensiId: 'LOG_GROWTH_10_2026-10-19',
      });

      expect(res).toBeDefined();
      expect(res.poin).toBe(20);
      expect(prisma.poinTransaksi.create).toHaveBeenCalled();
    });

    it('does not award duplicate points if referensiId already exists', async () => {
      const existing = {
        id: 1,
        userId: 10,
        poin: 20,
        referensiId: 'LOG_GROWTH_10_2026-10-19',
      };
      prisma.poinTransaksi.findFirst.mockResolvedValue(existing);

      const res = await rewardService.awardPoints(10, {
        jenisAktivitas: 'LOG_PERTUMBUHAN',
        poin: 20,
        deskripsi: 'Log Pertumbuhan',
        referensiId: 'LOG_GROWTH_10_2026-10-19',
      });

      expect(res).toEqual(existing);
      expect(prisma.poinTransaksi.create).not.toHaveBeenCalled();
    });

    it('ignores non-positive points', async () => {
      const res = await rewardService.awardPoints(10, {
        jenisAktivitas: 'TEST',
        poin: 0,
        deskripsi: 'Zero points',
      });

      expect(res).toBeNull();
      expect(prisma.poinTransaksi.create).not.toHaveBeenCalled();
    });
  });

  describe('calculateUserStreak', () => {
    it('returns 0 when user has no health logs', async () => {
      prisma.logKesehatan.findMany.mockResolvedValue([]);
      const streak = await rewardService.calculateUserStreak(10);
      expect(streak).toBe(0);
    });

    it('calculates consecutive days correctly ending today', async () => {
      const now = new Date('2026-10-19T10:00:00Z');
      prisma.logKesehatan.findMany.mockResolvedValue([
        { tanggalCatat: new Date('2026-10-19T00:00:00Z') },
        { tanggalCatat: new Date('2026-10-18T00:00:00Z') },
        { tanggalCatat: new Date('2026-10-17T00:00:00Z') },
      ]);

      const streak = await rewardService.calculateUserStreak(10, now);
      expect(streak).toBe(3);
    });
  });

  describe('redeemReward', () => {
    it('rejects redemption when reward does not exist', async () => {
      await expect(rewardService.redeemReward(10, 'invalid-reward-id')).rejects.toThrow(
        'Reward tidak valid atau tidak tersedia'
      );
    });

    it('rejects redemption when balance is insufficient', async () => {
      prisma.poinTransaksi.findMany.mockResolvedValue([{ poin: 100 }]); // total 100 < 200 required

      await expect(rewardService.redeemReward(10, 'v-20k')).rejects.toThrow(
        'Saldo poin tidak mencukupi'
      );
    });

    it('completes redemption when balance is sufficient', async () => {
      prisma.poinTransaksi.findMany.mockResolvedValue([{ poin: 300 }]);
      prisma.poinTransaksi.create.mockResolvedValue({ id: 101, poin: -200 });
      prisma.penukaranHadiah.create.mockResolvedValue({
        id: 55,
        rewardId: 'v-20k',
        namaHadiah: 'Voucher NutriShop Rp20.000',
        biayaPoin: 200,
        createdAt: new Date(),
      });

      const res = await rewardService.redeemReward(10, 'v-20k');
      expect(res.remainingPoints).toBe(100);
      expect(res.reward).toBe('Voucher NutriShop Rp20.000');
    });
  });

  describe('recordArticleRead', () => {
    it('awards 5 points if user has read < 3 articles today', async () => {
      prisma.riwayatBacaArtikel.count.mockResolvedValue(1);
      prisma.riwayatBacaArtikel.create.mockResolvedValue({});
      prisma.poinTransaksi.findFirst.mockResolvedValue(null);
      prisma.poinTransaksi.create.mockResolvedValue({ id: 1, poin: 5 });

      const res = await rewardService.recordArticleRead(10, 3);
      expect(res.awarded).toBe(true);
      expect(res.pointsAwarded).toBe(5);
    });

    it('does not award points if user has already read 3 articles today', async () => {
      prisma.riwayatBacaArtikel.count.mockResolvedValue(3);
      prisma.riwayatBacaArtikel.create.mockResolvedValue({});

      const res = await rewardService.recordArticleRead(10, 4);
      expect(res.awarded).toBe(false);
      expect(res.message).toContain('Batas harian');
    });
  });
});
