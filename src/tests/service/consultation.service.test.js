import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let consultationService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    profilAhliGizi: {
      findUnique: vi.fn(),
    },
    konsultasi: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaksi: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const specialist = {
  id: 3,
  isAvailable: true,
  biayaVideoCall: 100000,
  biayaChat: 50000,
  jadwal: {
    hari: ['Selasa'],
    waktu: ['09:00', '10:00'],
  },
  user: {
    nama: 'Dr. Gizi',
    email: 'gizi@example.com',
    isActive: true,
    deletedAt: null,
  },
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/consultation.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  consultationService = require('../../services/consultation.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  loadService();
});

describe('consultationService.getAvailability', () => {
  it('returns unavailable booked slot and available free slot', async () => {
    prisma.profilAhliGizi.findUnique.mockResolvedValue(specialist);
    prisma.konsultasi.findMany.mockResolvedValue([
      { jadwalSesi: new Date('2026-05-26T02:00:00.000Z') },
    ]);

    const result = await consultationService.getAvailability(3, '2026-05-26');

    expect(result).toEqual([
      { time: '09:00', isAvailable: false },
      { time: '10:00', isAvailable: true },
    ]);
  });

  it('rejects unavailable or inactive specialist', async () => {
    prisma.profilAhliGizi.findUnique.mockResolvedValue({
      ...specialist,
      isAvailable: false,
    });

    await expect(consultationService.getAvailability(3, '2026-05-26')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Jadwal spesialis tidak ditemukan',
    });
  });
});

describe('consultationService.createBooking', () => {
  it('rejects conflicting slot inside transaction', async () => {
    prisma.profilAhliGizi.findUnique.mockResolvedValue(specialist);
    prisma.konsultasi.findFirst = vi.fn().mockResolvedValue({ id: 44 });

    await expect(
      consultationService.createBooking(7, {
        ahliGiziId: 3,
        jadwalSesi: '2026-05-26T02:00:00.000Z',
        metode: 'VIDEO_CALL',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Jadwal sudah terisi, silakan pilih waktu lain',
    });
  });
});

describe('consultationService ownership actions', () => {
  it('rejects rescheduling another user consultation', async () => {
    prisma.konsultasi.findUnique.mockResolvedValue({
      id: 10,
      userId: 99,
    });

    await expect(
      consultationService.reschedule(10, 7, '2026-05-26T03:00:00.000Z'),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Konsultasi tidak ditemukan',
    });
  });

  it('cancels owner consultation with reason', async () => {
    const cancelled = {
      id: 10,
      status: 'CANCELLED',
      catatanKonsultasi: 'Dibatalkan: Sakit',
    };

    prisma.konsultasi.findUnique.mockResolvedValue({
      id: 10,
      userId: 7,
    });
    prisma.konsultasi.update.mockResolvedValue(cancelled);

    await expect(consultationService.cancel(10, 7, 'Sakit')).resolves.toEqual(cancelled);
    expect(prisma.konsultasi.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: 'CANCELLED',
        catatanKonsultasi: 'Dibatalkan: Sakit',
      },
    });
  });

  it('confirms payment by updating transaction and consultation status', async () => {
    const confirmed = { id: 10, status: 'CONFIRMED' };

    prisma.konsultasi.findUnique.mockResolvedValue({
      id: 10,
      userId: 7,
      transaksiId: 22,
      transaksi: { id: 22 },
    });
    prisma.transaksi.update.mockResolvedValue({ id: 22, statusBayar: 'SUCCESS' });
    prisma.konsultasi.update.mockResolvedValue(confirmed);

    await expect(consultationService.confirmPayment(10, 7)).resolves.toEqual(confirmed);
    expect(prisma.transaksi.update).toHaveBeenCalledWith({
      where: { id: 22 },
      data: {
        statusBayar: 'SUCCESS',
        paidAt: expect.any(Date),
      },
    });
    expect(prisma.konsultasi.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: 'CONFIRMED' },
    });
  });
});

