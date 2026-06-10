import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let childrenService;

const { prisma, aiService } = vi.hoisted(() => ({
  prisma: {
    balita: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    rekamPertumbuhan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    pertumbuhanLakiLaki: {
      findUnique: vi.fn(),
    },
    pertumbuhanPerempuan: {
      findUnique: vi.fn(),
    },
    bmi: {
      findMany: vi.fn(),
    },
  },
  aiService: {
    predictStunting: vi.fn(),
  },
}));

const child = {
  id: 1,
  userId: 7,
  namaDepan: 'Leo',
  namaAkhir: null,
  tanggalLahir: new Date('2025-01-01T00:00:00.000Z'),
  jenisKelamin: 'LAKI_LAKI',
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const aiServicePath = require.resolve('../../services/ai.service');
  const servicePath = require.resolve('../../services/children.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };
  require.cache[aiServicePath] = {
    id: aiServicePath,
    filename: aiServicePath,
    loaded: true,
    exports: aiService,
  };

  childrenService = require('../../services/children.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  loadService();
});

describe('childrenService.createGrowthRecord', () => {
  it('API-P0-010 creates a growth record with AI prediction for the owner child', async () => {
    const savedRecord = {
      id: 101,
      balitaId: child.id,
      tinggiBadan: 75,
      beratBadan: 9.5,
      tanggalCatat: new Date('2025-12-01T00:00:00.000Z'),
      risikoStuntingMl: 'Normal',
      mlConfidence: 92,
    };

    prisma.balita.findUnique.mockResolvedValue(child);
    prisma.user.findUnique.mockResolvedValue({ tinggiBadanIbu: 158 });
    aiService.predictStunting.mockResolvedValue({
      prediction_label: 'Normal',
      confidence: 0.92,
    });
    prisma.rekamPertumbuhan.create.mockResolvedValue(savedRecord);

    await expect(
      childrenService.createGrowthRecord(child.id, 7, {
        tinggiBadan: 75,
        beratBadan: 9.5,
        tanggalCatat: '2025-12-01',
      }),
    ).resolves.toEqual(savedRecord);

    expect(aiService.predictStunting).toHaveBeenCalledWith(
      expect.objectContaining({
        jenisKelamin: 'LAKI_LAKI',
        tinggiBadan: 75,
        beratBadan: 9.5,
        tinggiBadanIbu: 158,
      }),
    );
    expect(prisma.rekamPertumbuhan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        balitaId: child.id,
        tinggiBadan: 75,
        beratBadan: 9.5,
        risikoStuntingMl: 'Normal',
        mlConfidence: 92,
      }),
    });
  });

  it('API-P0-010 rejects growth record for another user child', async () => {
    prisma.balita.findUnique.mockResolvedValue({
      ...child,
      userId: 99,
    });

    await expect(
      childrenService.createGrowthRecord(child.id, 7, {
        tinggiBadan: 75,
        beratBadan: 9.5,
        tanggalCatat: '2025-12-01',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Akses tidak diizinkan',
    });
  });

  it('API-P0-010 rejects future measurement date', async () => {
    prisma.balita.findUnique.mockResolvedValue(child);

    await expect(
      childrenService.createGrowthRecord(child.id, 7, {
        tinggiBadan: 75,
        beratBadan: 9.5,
        tanggalCatat: '2999-01-01',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Tanggal pengukuran tidak boleh di masa depan',
    });

    expect(prisma.rekamPertumbuhan.create).not.toHaveBeenCalled();
  });

  it('API-P0-010 documents missing validation for measurement date before child birth date', async () => {
    const savedRecord = {
      id: 102,
      balitaId: child.id,
      tinggiBadan: 75,
      beratBadan: 9.5,
      tanggalCatat: new Date('2024-12-01T00:00:00.000Z'),
    };

    prisma.balita.findUnique.mockResolvedValue(child);
    prisma.user.findUnique.mockResolvedValue({ tinggiBadanIbu: 158 });
    aiService.predictStunting.mockResolvedValue({
      prediction_label: 'Normal',
      confidence: 0.92,
    });
    prisma.rekamPertumbuhan.findFirst.mockResolvedValue(null);
    prisma.rekamPertumbuhan.create.mockResolvedValue(savedRecord);

    await expect(
      childrenService.createGrowthRecord(child.id, 7, {
        tinggiBadan: 75,
        beratBadan: 9.5,
        tanggalCatat: '2024-12-01',
      }),
    ).resolves.toEqual(savedRecord);
  });

  it('API-P0-010 rejects duplicate measurement date for the same child', async () => {
    prisma.balita.findUnique.mockResolvedValue(child);
    prisma.rekamPertumbuhan.findFirst.mockResolvedValue({
      id: 100,
      balitaId: child.id,
      tanggalCatat: new Date('2025-12-01T00:00:00.000Z'),
    });

    await expect(
      childrenService.createGrowthRecord(child.id, 7, {
        tinggiBadan: 75,
        beratBadan: 9.5,
        tanggalCatat: '2025-12-01',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Pertumbuhan anak pada tanggal ini sudah tercatat',
    });

    expect(prisma.rekamPertumbuhan.create).not.toHaveBeenCalled();
  });
});

describe('childrenService.getLatestGrowth', () => {
  it('API-P1-017 returns null data when child has no growth record', async () => {
    prisma.balita.findUnique.mockResolvedValue(child);
    prisma.rekamPertumbuhan.findFirst.mockResolvedValue(null);

    await expect(childrenService.getLatestGrowth(child.id, 7)).resolves.toEqual({
      message: 'Belum ada data pertumbuhan anak. Silakan input data pertama!',
      data: null,
    });
  });
});

describe('childrenService.deleteChild', () => {
  it('API-P0-009 deletes owner child', async () => {
    prisma.balita.findUnique.mockResolvedValue(child);
    prisma.balita.delete.mockResolvedValue(child);

    await expect(childrenService.deleteChild(child.id, 7)).resolves.toEqual(child);

    expect(prisma.balita.delete).toHaveBeenCalledWith({
      where: { id: child.id },
    });
  });

  it('API-P0-009 rejects deleting another user child', async () => {
    prisma.balita.findUnique.mockResolvedValue({
      ...child,
      userId: 99,
    });

    await expect(childrenService.deleteChild(child.id, 7)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Akses tidak diizinkan',
    });

    expect(prisma.balita.delete).not.toHaveBeenCalled();
  });
});
