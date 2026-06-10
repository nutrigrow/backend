import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let adminService;

const { prisma, bcrypt, imageCompressor } = vi.hoisted(() => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    produkNutrishop: {
      update: vi.fn(),
    },
    transaksi: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    artikelEdukasi: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  bcrypt: {
    hash: vi.fn(),
  },
  imageCompressor: {
    compressAndSaveProductImage: vi.fn(),
    compressAndSaveArticleImage: vi.fn(),
  },
}));

const adminUser = {
  id: 1,
  nama: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
  avatarUrl: null,
  isActive: true,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  tinggiBadanIbu: null,
};

const shopOrder = {
  id: 5,
  midtransOrderId: 'SHOP-5-7',
  midtransTransactionId: null,
  jenisTransaksi: 'SHOP',
  statusBayar: 'PENDING',
  totalHarga: 45000,
  biayaPengiriman: 5000,
  metodePengiriman: 'STANDARD',
  snapToken: null,
  paymentType: null,
  tanggalTransaksi: new Date('2026-05-25T00:00:00.000Z'),
  paidAt: null,
  createdAt: new Date('2026-05-25T00:00:00.000Z'),
  updatedAt: new Date('2026-05-25T00:00:00.000Z'),
  user: { id: 7, nama: 'Bunda', email: 'bunda@example.com', avatarUrl: null },
  alamat: { id: 2 },
  detailTransaksi: [
    {
      id: 1,
      produkId: 10,
      kuantitas: 2,
      hargaSatuan: 20000,
      subtotal: 40000,
      produk: { id: 10, namaProduk: 'Susu', harga: 20000, kategori: 'MPASI' },
    },
  ],
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const bcryptPath = require.resolve('bcryptjs');
  const imageCompressorPath = require.resolve('../../utils/imageCompressor');
  const servicePath = require.resolve('../../services/admin.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };
  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcrypt,
  };
  require.cache[imageCompressorPath] = {
    id: imageCompressorPath,
    filename: imageCompressorPath,
    loaded: true,
    exports: imageCompressor,
  };

  adminService = require('../../services/admin.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  bcrypt.hash.mockResolvedValue('hashed-password');
  loadService();
});

describe('adminService.setUserActive', () => {
  it('rejects deactivating the last active admin', async () => {
    prisma.user.findFirst.mockResolvedValue(adminUser);
    prisma.user.count.mockResolvedValue(0);

    await expect(adminService.setUserActive(1, { isActive: false })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Admin terakhir tidak boleh dinonaktifkan atau dihapus',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('adminService.createNutritionist', () => {
  it('rejects duplicate nutritionist email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 20, email: 'gizi@example.com' });

    await expect(
      adminService.createNutritionist({
        nama: 'Dr. Gizi',
        email: 'gizi@example.com',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email sudah terdaftar',
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('adminService.createArticle', () => {
  it('generates a unique slug and creates a draft article by default', async () => {
    prisma.artikelEdukasi.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null);

    const createdArticle = {
      id: 2,
      judul: 'MPASI Sehat',
      slug: 'mpasi-sehat-2',
      konten: 'Isi artikel',
      kategori: 'MPASI',
      gambarUrl: null,
      penulis: 'Admin',
      isPublished: false,
      publishedAt: null,
      createdAt: new Date('2026-05-25T00:00:00.000Z'),
      updatedAt: new Date('2026-05-25T00:00:00.000Z'),
    };
    prisma.artikelEdukasi.create.mockResolvedValue(createdArticle);

    const result = await adminService.createArticle({
      judul: 'MPASI Sehat',
      konten: 'Isi artikel',
      kategori: 'MPASI',
      penulis: 'Admin',
    });

    expect(result).toMatchObject({
      id: 2,
      slug: 'mpasi-sehat-2',
      status: 'DRAFT',
    });
    expect(prisma.artikelEdukasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        judul: 'MPASI Sehat',
        slug: 'mpasi-sehat-2',
        isPublished: false,
        publishedAt: null,
      }),
    });
  });
});

describe('adminService.updateShopOrderStatus', () => {
  it('restores stock when pending shop order moves to failed-like status', async () => {
    const updatedOrder = {
      ...shopOrder,
      statusBayar: 'FAILED',
    };

    prisma.transaksi.findFirst.mockResolvedValue(shopOrder);
    prisma.produkNutrishop.update.mockResolvedValue({ id: 10, stok: 7 });
    prisma.transaksi.update.mockResolvedValue(updatedOrder);

    const result = await adminService.updateShopOrderStatus(5, { statusBayar: 'FAILED' });

    expect(result).toMatchObject({
      id: 5,
      statusBayar: 'FAILED',
      items: [
        expect.objectContaining({
          produkId: 10,
          kuantitas: 2,
        }),
      ],
    });
    expect(prisma.produkNutrishop.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { stok: { increment: 2 } },
    });
    expect(prisma.transaksi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          statusBayar: 'FAILED',
        }),
      }),
    );
  });
});

