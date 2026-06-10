import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let healthLogService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    logKesehatan: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    rekamPertumbuhan: {
      findMany: vi.fn(),
    },
    konsultasi: {
      findFirst: vi.fn(),
    },
    balita: {
      findMany: vi.fn(),
    },
  },
}));

const teenPayload = {
  date: '2026-05-25',
  profile_type: 'teen',
  water_glasses: 8,
  sleep_hours: 7.5,
  took_supplement: true,
  mood: 4,
  is_menstruating: false,
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/healthLog.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  healthLogService = require('../../services/healthLog.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  loadService();
});

describe('healthLogService.createOrUpdateLog', () => {
  it('API-P0-013 creates a log when the user has no entry on that date', async () => {
    const savedLog = {
      id: 1,
      userId: 7,
      tanggalCatat: new Date('2026-05-25T00:00:00.000Z'),
      day: 'Monday',
      fase: 'REMAJA',
      jumlahGelasAir: 8,
      durasiTidur: 7.5,
      minumSuplemen: true,
      mood: 4,
      sedangHaid: false,
      beratBadanKg: null,
      frekuensiMenyusui: null,
      createdAt: new Date('2026-05-25T00:00:00.000Z'),
      updatedAt: new Date('2026-05-25T00:00:00.000Z'),
    };

    prisma.logKesehatan.findUnique.mockResolvedValue(null);
    prisma.logKesehatan.upsert.mockResolvedValue(savedLog);

    const result = await healthLogService.createOrUpdateLog(7, teenPayload);

    expect(result).toMatchObject({
      id: 1,
      user_id: 7,
      date: '2026-05-25',
      profile_type: 'teen',
      water_glasses: 8,
      sleep_hours: 7.5,
      took_supplement: true,
    });
    expect(prisma.logKesehatan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_tanggalCatat: {
            userId: 7,
            tanggalCatat: expect.any(Date),
          },
        },
        create: expect.objectContaining({
          userId: 7,
          fase: 'REMAJA',
          jumlahGelasAir: 8,
        }),
        update: expect.objectContaining({
          fase: 'REMAJA',
          jumlahGelasAir: 8,
        }),
      }),
    );
  });

  it('API-P0-013 rejects duplicate same-day input unless editing', async () => {
    prisma.logKesehatan.findUnique.mockResolvedValue({ fase: 'REMAJA' });

    await expect(
      healthLogService.createOrUpdateLog(7, teenPayload),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Anda sudah memasukkan entry untuk hari ini.',
    });

    expect(prisma.logKesehatan.upsert).not.toHaveBeenCalled();
  });

  it('API-P0-013 rejects changing profile type on an existing date', async () => {
    prisma.logKesehatan.findUnique.mockResolvedValue({ fase: 'HAMIL' });

    await expect(
      healthLogService.createOrUpdateLog(7, teenPayload),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        'Log tanggal ini sudah diisi dengan profile_type "pregnant". Tidak bisa diubah ke profile_type yang berbeda dalam satu hari.',
    });
  });

  it('API-P0-013 rejects future health log date', async () => {
    await expect(
      healthLogService.createOrUpdateLog(7, {
        ...teenPayload,
        date: '2999-01-01',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Tanggal catatan kesehatan tidak boleh di masa depan',
    });

    expect(prisma.logKesehatan.findUnique).not.toHaveBeenCalled();
    expect(prisma.logKesehatan.upsert).not.toHaveBeenCalled();
  });
});

describe('healthLogService.getInsight', () => {
  it('API-P0-015 returns has_log_today=false when today log is missing', async () => {
    prisma.logKesehatan.findUnique.mockResolvedValue(null);
    prisma.rekamPertumbuhan.findMany.mockResolvedValue([]);

    await expect(healthLogService.getInsight(7)).resolves.toEqual({
      has_log_today: false,
    });
  });
});
