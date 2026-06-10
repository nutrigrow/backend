import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let specialistService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    profilAhliGizi: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    konsultasi: {
      findMany: vi.fn(),
    },
  },
}));

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/specialist.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  specialistService = require('../../services/specialist.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  loadService();
});

describe('specialistService.getAllSpecialists', () => {
  it('returns active available specialists with filters and pagination', async () => {
    prisma.profilAhliGizi.count.mockResolvedValue(1);
    prisma.profilAhliGizi.findMany.mockResolvedValue([
      {
        id: 1,
        nama: 'Dr. Gizi',
        jadwal: null,
        user: {
          nama: 'Dr. Gizi',
          isActive: true,
          deletedAt: null,
        },
      },
    ]);

    const result = await specialistService.getAllSpecialists(
      { search: 'gizi', category: 'Anak' },
      { page: 2, limit: 3 },
    );

    expect(result).toMatchObject({
      pagination: {
        total: 1,
        page: 2,
        limit: 3,
        totalPages: 1,
      },
      specialists: [
        expect.objectContaining({
          id: 1,
          nextAvailable: null,
        }),
      ],
    });
    expect(prisma.profilAhliGizi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isAvailable: true,
          spesialisasi: 'Anak',
          OR: expect.any(Array),
        }),
        skip: 3,
        take: 3,
      }),
    );
  });
});

describe('specialistService.getSpecialistById', () => {
  it('returns active specialist detail', async () => {
    prisma.profilAhliGizi.findUnique.mockResolvedValue({
      id: 1,
      isAvailable: true,
      jadwal: null,
      user: {
        nama: 'Dr. Gizi',
        isActive: true,
        deletedAt: null,
      },
    });

    const result = await specialistService.getSpecialistById(1);

    expect(result).toMatchObject({
      id: 1,
      nextAvailable: null,
    });
  });

  it('rejects inactive specialist detail', async () => {
    prisma.profilAhliGizi.findUnique.mockResolvedValue({
      id: 1,
      isAvailable: false,
      user: {
        isActive: true,
        deletedAt: null,
      },
    });

    await expect(specialistService.getSpecialistById(1)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Spesialis tidak ditemukan',
    });
  });
});

