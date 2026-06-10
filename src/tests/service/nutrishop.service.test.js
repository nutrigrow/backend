import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let nutrishopService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    produkNutrishop: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    keranjang: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    alamatPengiriman: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    transaksi: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const product = {
  id: 1,
  namaProduk: 'Susu Balita',
  deskripsi: 'Susu pertumbuhan',
  harga: 20000,
  stok: 5,
  gambarUrl: null,
  kategori: 'MPASI',
  isActive: true,
};

const address = {
  id: 10,
  userId: 7,
  namaPenerima: 'Bunda',
  noTelepon: '081234567890',
  alamatLengkap: 'Jl. Sehat No. 1',
  kelurahan: 'Sukamaju',
  kecamatan: 'Sehat',
  kota: 'Bandung',
  kodePos: '40111',
  isUtama: true,
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/nutrishop.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  nutrishopService = require('../../services/nutrishop.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  loadService();
});

describe('nutrishopService.addToCart', () => {
  it('API-P0-003 rejects product when stock is insufficient', async () => {
    prisma.produkNutrishop.findUnique.mockResolvedValue({
      ...product,
      stok: 0,
    });

    await expect(
      nutrishopService.addToCart(7, { produkId: 1, kuantitas: 1 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Insufficient stock for product: Susu Balita',
    });
  });

  it('API-P0-003 creates a cart item when product stock is enough', async () => {
    const createdCartItem = {
      id: 99,
      userId: 7,
      produkId: 1,
      kuantitas: 2,
      produk: product,
    };

    prisma.produkNutrishop.findUnique.mockResolvedValue(product);
    prisma.keranjang.findFirst.mockResolvedValue(null);
    prisma.keranjang.create.mockResolvedValue(createdCartItem);

    await expect(
      nutrishopService.addToCart(7, { produkId: 1, kuantitas: 2 }),
    ).resolves.toEqual(createdCartItem);

    expect(prisma.keranjang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 7,
          produkId: 1,
          kuantitas: 2,
        },
      }),
    );
  });
});

describe('nutrishopService.checkoutDirect', () => {
  it('API-P0-005 rejects checkout when address does not belong to user', async () => {
    prisma.produkNutrishop.findUnique.mockResolvedValue(product);
    prisma.alamatPengiriman.findFirst.mockResolvedValue(null);

    await expect(
      nutrishopService.checkoutDirect(7, {
        produkId: 1,
        kuantitas: 1,
        alamatId: 99,
        metodePengiriman: 'STANDARD',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Address not found or does not belong to user',
    });
  });

  it('API-P0-005 creates a pending shop order and decrements stock', async () => {
    const order = {
      id: 123,
      midtransOrderId: 'SHOP-1-7',
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
      alamat: address,
      detailTransaksi: [
        {
          id: 1,
          produkId: product.id,
          kuantitas: 2,
          hargaSatuan: product.harga,
          subtotal: product.harga * 2,
          produk: product,
        },
      ],
    };

    prisma.produkNutrishop.findUnique.mockResolvedValue(product);
    prisma.alamatPengiriman.findFirst.mockResolvedValue(address);
    prisma.transaksi.create.mockResolvedValue(order);
    prisma.produkNutrishop.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      nama: 'Bunda',
      email: 'bunda@example.com',
    });

    const result = await nutrishopService.checkoutDirect(7, {
      produkId: 1,
      kuantitas: 2,
      alamatId: address.id,
      metodePengiriman: 'STANDARD',
    });

    expect(result).toMatchObject({
      id: 123,
      statusBayar: 'PENDING',
      totalHarga: 45000,
      itemCount: 2,
      paymentGatewayConfigured: false,
    });
    expect(prisma.produkNutrishop.updateMany).toHaveBeenCalledWith({
      where: {
        id: product.id,
        stok: { gte: 2 },
      },
      data: {
        stok: { decrement: 2 },
      },
    });
  });
});
