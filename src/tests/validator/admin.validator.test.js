import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  setUserActiveSchema,
  createProductSchema,
  updateProductSchema,
  createNutritionistSchema,
  articleListSchema,
  createArticleSchema,
  updateShopOrderStatusSchema,
  consultationListSchema,
  updateConsultationSchema,
} = require('../../validators/admin.validator.js');

describe('admin.validator user schemas', () => {
  it('coerces string boolean in set user active payload', () => {
    const result = setUserActiveSchema.body.safeParse({ isActive: 'false' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ isActive: false });
  });

  it('rejects non-numeric id param', () => {
    const result = setUserActiveSchema.params.safeParse({ id: 'abc' });

    expect(result.success).toBe(false);
  });
});

describe('admin.validator product schemas', () => {
  it('coerces numeric product fields on create', () => {
    const result = createProductSchema.body.safeParse({
      namaProduk: 'Susu',
      kategori: 'MPASI',
      harga: '20000',
      stok: '5',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      harga: 20000,
      stok: 5,
    });
  });

  it('rejects invalid product category on update', () => {
    const result = updateProductSchema.body.safeParse({
      kategori: 'INVALID',
    });

    expect(result.success).toBe(false);
  });
});

describe('admin.validator nutritionist schemas', () => {
  it('accepts valid nutritionist payload and normalizes email', () => {
    const result = createNutritionistSchema.body.safeParse({
      nama: 'Dr. Gizi',
      email: 'GIZI@EXAMPLE.COM',
      pengalamanTahun: '5',
      biayaVideoCall: '100000',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      email: 'gizi@example.com',
      pengalamanTahun: 5,
      biayaVideoCall: 100000,
    });
  });
});

describe('admin.validator article schemas', () => {
  it('accepts valid article list filter', () => {
    const result = articleListSchema.query.safeParse({
      kategori: 'MPASI',
      status: 'PUBLISHED',
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing required article title on create', () => {
    const result = createArticleSchema.body.safeParse({
      kategori: 'MPASI',
    });

    expect(result.success).toBe(false);
  });
});

describe('admin.validator transaction and consultation schemas', () => {
  it('rejects invalid shop order status', () => {
    const result = updateShopOrderStatusSchema.body.safeParse({
      statusBayar: 'PAID',
    });

    expect(result.success).toBe(false);
  });

  it('accepts consultation filters and update payload', () => {
    const filterResult = consultationListSchema.query.safeParse({
      status: 'BOOKED',
      metode: 'VIDEO_CALL',
    });
    const updateResult = updateConsultationSchema.body.safeParse({
      status: 'CONFIRMED',
      linkMeeting: 'https://meet.example.com/abc',
    });

    expect(filterResult.success).toBe(true);
    expect(updateResult.success).toBe(true);
  });
});

