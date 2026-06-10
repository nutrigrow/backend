import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, bearer, createApiTestContext } from '../helpers/apiTestUtils.js';

describe('NutriShop API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P0-001 GET /api/products requires authentication', async () => {
    const res = await ctx.request.get('/api/products');

    expect(res.status).toBe(401);
    expect(ctx.services.nutrishop.getProducts).not.toHaveBeenCalled();
  });

  it('API-P0-001 GET /api/products returns filtered products', async () => {
    ctx.services.nutrishop.getProducts.mockResolvedValue([
      { id: 1, namaProduk: 'Susu Balita', stok: 3 },
    ]);

    const res = await ctx.request
      .get('/api/products')
      .set('Authorization', bearer(ctx.userToken))
      .query({ search: 'susu', kategori: 'MPASI', minPrice: '1000', maxPrice: '50000' });

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(ctx.services.nutrishop.getProducts).toHaveBeenCalledWith({
      search: 'susu',
      kategori: 'MPASI',
      minPrice: '1000',
      maxPrice: '50000',
      availableOnly: undefined,
    });
  });

  it('API-P0-002 GET /api/products/:id returns product detail with stock', async () => {
    ctx.services.nutrishop.getProductById.mockResolvedValue({ id: 1, stok: 0 });

    const res = await ctx.request
      .get('/api/products/1')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.product).toEqual({ id: 1, stok: 0 });
    expect(ctx.services.nutrishop.getProductById).toHaveBeenCalledWith('1');
  });

  it('API-P1-007 GET /api/cart returns authenticated user cart', async () => {
    ctx.services.nutrishop.getCart.mockResolvedValue([{ id: 1, produkId: 2 }]);

    const res = await ctx.request.get('/api/cart').set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.cart).toEqual([{ id: 1, produkId: 2 }]);
    expect(ctx.services.nutrishop.getCart).toHaveBeenCalledWith(7);
  });

  it('API-P0-003 POST /api/cart adds a valid product to cart', async () => {
    ctx.services.nutrishop.addToCart.mockResolvedValue({ id: 10, produkId: 1, kuantitas: 2 });

    const res = await ctx.request
      .post('/api/cart')
      .set('Authorization', bearer(ctx.userToken))
      .send({ produkId: 1, kuantitas: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.cartItem).toEqual({ id: 10, produkId: 1, kuantitas: 2 });
    expect(ctx.services.nutrishop.addToCart).toHaveBeenCalledWith(7, {
      produkId: 1,
      kuantitas: 2,
    });
  });

  it('API-P0-003 POST /api/cart rejects insufficient stock', async () => {
    ctx.services.nutrishop.addToCart.mockRejectedValue(
      ApiError.badRequest('Insufficient stock for product: Susu Balita'),
    );

    const res = await ctx.request
      .post('/api/cart')
      .set('Authorization', bearer(ctx.userToken))
      .send({ produkId: 1, kuantitas: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Insufficient stock for product: Susu Balita');
  });

  it('API-P0-004 PATCH /api/cart/:id updates quantity with ownership context', async () => {
    ctx.services.nutrishop.updateCartItemQuantity.mockResolvedValue({ id: 5, kuantitas: 3 });

    const res = await ctx.request
      .patch('/api/cart/5')
      .set('Authorization', bearer(ctx.userToken))
      .send({ kuantitas: 3 });

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.updateCartItemQuantity).toHaveBeenCalledWith(7, '5', {
      kuantitas: 3,
    });
  });

  it('API-P1-008 DELETE /api/cart/:id deletes only authenticated user item', async () => {
    ctx.services.nutrishop.deleteCartItem.mockResolvedValue({ id: 5 });

    const res = await ctx.request
      .delete('/api/cart/5')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.deleteCartItem).toHaveBeenCalledWith(7, '5');
  });

  it('API-P1-009 POST /api/addresses creates an address', async () => {
    const payload = { namaPenerima: 'Bunda', alamatLengkap: 'Jl. Sehat' };
    ctx.services.nutrishop.addAddress.mockResolvedValue({ id: 2, ...payload });

    const res = await ctx.request
      .post('/api/addresses')
      .set('Authorization', bearer(ctx.userToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.nutrishop.addAddress).toHaveBeenCalledWith(7, payload);
  });

  it('API-P1-010 GET /api/addresses returns only authenticated user addresses', async () => {
    ctx.services.nutrishop.getAddresses.mockResolvedValue([{ id: 2 }]);

    const res = await ctx.request
      .get('/api/addresses')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.addresses).toEqual([{ id: 2 }]);
    expect(ctx.services.nutrishop.getAddresses).toHaveBeenCalledWith(7);
  });

  it('API-P0-006 POST /api/checkout/cart checks out a valid cart', async () => {
    ctx.services.nutrishop.checkoutCart.mockResolvedValue({ id: 99, statusBayar: 'PENDING' });

    const res = await ctx.request
      .post('/api/checkout/cart')
      .set('Authorization', bearer(ctx.userToken))
      .send({ alamatId: 2, metodePengiriman: 'STANDARD' });

    expect(res.status).toBe(201);
    expect(ctx.services.nutrishop.checkoutCart).toHaveBeenCalledWith(7, {
      alamatId: 2,
      metodePengiriman: 'STANDARD',
    });
  });

  it('API-P0-006 POST /api/checkout/cart rejects empty cart or insufficient stock', async () => {
    ctx.services.nutrishop.checkoutCart.mockRejectedValue(ApiError.badRequest('Cart is empty'));

    const res = await ctx.request
      .post('/api/checkout/cart')
      .set('Authorization', bearer(ctx.userToken))
      .send({ alamatId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cart is empty');
  });

  it('API-P0-005 POST /api/checkout/direct creates a direct checkout order', async () => {
    ctx.services.nutrishop.checkoutDirect.mockResolvedValue({ id: 100, itemCount: 1 });

    const res = await ctx.request
      .post('/api/checkout/direct')
      .set('Authorization', bearer(ctx.userToken))
      .send({ produkId: 1, kuantitas: 1, alamatId: 2 });

    expect(res.status).toBe(201);
    expect(ctx.services.nutrishop.checkoutDirect).toHaveBeenCalledWith(7, {
      produkId: 1,
      kuantitas: 1,
      alamatId: 2,
    });
  });

  it('API-P0-005 POST /api/checkout/direct rejects address from another user', async () => {
    ctx.services.nutrishop.checkoutDirect.mockRejectedValue(
      ApiError.notFound('Address not found or does not belong to user'),
    );

    const res = await ctx.request
      .post('/api/checkout/direct')
      .set('Authorization', bearer(ctx.userToken))
      .send({ produkId: 1, kuantitas: 1, alamatId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Address not found or does not belong to user');
  });

  it('API-P1-011 GET /api/orders returns authenticated user orders with filters', async () => {
    ctx.services.nutrishop.getOrders.mockResolvedValue([{ id: 1, statusBayar: 'PENDING' }]);

    const res = await ctx.request
      .get('/api/orders')
      .set('Authorization', bearer(ctx.userToken))
      .query({ statusBayar: 'PENDING' });

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.getOrders).toHaveBeenCalledWith(7, { statusBayar: 'PENDING' });
  });

  it('API-P1-012 GET /api/orders/:id validates order ownership in service', async () => {
    ctx.services.nutrishop.getOrderById.mockResolvedValue({ id: 1 });

    const res = await ctx.request
      .get('/api/orders/1')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.getOrderById).toHaveBeenCalledWith(7, '1');
  });

  it('API-P1-013 POST /api/orders/:id/pay creates a payment for pending order', async () => {
    ctx.services.nutrishop.createPaymentForOrder.mockResolvedValue({ id: 1, snapToken: 'snap' });

    const res = await ctx.request
      .post('/api/orders/1/pay')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.createPaymentForOrder).toHaveBeenCalledWith(7, '1');
  });

  it('API-P1-014 POST /api/orders/:id/sync-payment syncs Midtrans payment status', async () => {
    ctx.services.nutrishop.syncOrderPaymentStatus.mockResolvedValue({ id: 1, statusBayar: 'SUCCESS' });

    const res = await ctx.request
      .post('/api/orders/1/sync-payment')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.syncOrderPaymentStatus).toHaveBeenCalledWith(7, '1');
  });

  it('API-WH-001 POST /api/midtrans/webhook handles public payment webhook', async () => {
    ctx.services.nutrishop.handleMidtransWebhook.mockResolvedValue({
      id: 1,
      statusBayar: 'SUCCESS',
    });

    const payload = { order_id: 'SHOP-1-7', transaction_status: 'settlement' };
    const res = await ctx.request.post('/api/midtrans/webhook').send(payload);

    expect(res.status).toBe(200);
    expect(ctx.services.nutrishop.handleMidtransWebhook).toHaveBeenCalledWith(payload);
  });
});
