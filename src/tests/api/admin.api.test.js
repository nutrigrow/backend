import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createApiTestContext } from '../helpers/apiTestUtils.js';

describe('Admin API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P2-005 GET /api/admin/dashboard rejects missing token', async () => {
    const res = await ctx.request.get('/api/admin/dashboard');

    expect(res.status).toBe(401);
    expect(ctx.services.admin.getDashboard).not.toHaveBeenCalled();
  });

  it('API-P2-005 GET /api/admin/dashboard rejects non-admin user', async () => {
    const res = await ctx.request
      .get('/api/admin/dashboard')
      .set('Authorization', bearer(ctx.userToken));

    expect(res.status).toBe(403);
    expect(ctx.services.admin.getDashboard).not.toHaveBeenCalled();
  });

  it('API-P2-005 GET /api/admin/dashboard returns dashboard for admin', async () => {
    ctx.services.admin.getDashboard.mockResolvedValue({ totalUsers: 10 });

    const res = await ctx.request
      .get('/api/admin/dashboard')
      .set('Authorization', bearer(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ totalUsers: 10 });
    expect(ctx.services.admin.getDashboard).toHaveBeenCalled();
  });

  it('API-P2-006 GET /api/admin/users lists users with filters', async () => {
    ctx.services.admin.getUsers.mockResolvedValue({ data: [{ id: 7 }] });

    const res = await ctx.request
      .get('/api/admin/users')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ search: 'bunda', role: 'USER', page: '1' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getUsers).toHaveBeenCalledWith({
      search: 'bunda',
      role: 'USER',
      page: '1',
    });
  });

  it('API-P2-007 PATCH /api/admin/users/:id/active toggles user active state', async () => {
    ctx.services.admin.setUserActive.mockResolvedValue({ id: 7, isActive: false });

    const res = await ctx.request
      .patch('/api/admin/users/7/active')
      .set('Authorization', bearer(ctx.adminToken))
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.setUserActive).toHaveBeenCalledWith('7', { isActive: false });
  });

  it('API-P2-007 PATCH /api/admin/users/:id/active rejects invalid id before service call', async () => {
    const res = await ctx.request
      .patch('/api/admin/users/not-number/active')
      .set('Authorization', bearer(ctx.adminToken))
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(ctx.services.admin.setUserActive).not.toHaveBeenCalled();
  });

  it('API-P2-008 DELETE /api/admin/users/:id deletes user', async () => {
    ctx.services.admin.deleteUser.mockResolvedValue({ id: 7, deletedAt: 'now' });

    const res = await ctx.request
      .delete('/api/admin/users/7')
      .set('Authorization', bearer(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(ctx.services.admin.deleteUser).toHaveBeenCalledWith('7');
  });

  it('API-P2-009 GET /api/admin/products lists products with filters', async () => {
    ctx.services.admin.getProducts.mockResolvedValue({ data: [{ id: 1 }] });

    const res = await ctx.request
      .get('/api/admin/products')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ kategori: 'MPASI', minStock: '1' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getProducts).toHaveBeenCalledWith({ kategori: 'MPASI', minStock: '1' });
  });

  it('API-P2-010 POST /api/admin/products creates product with valid fields', async () => {
    const payload = { namaProduk: 'Susu', kategori: 'MPASI', harga: 20000, stok: 5 };
    ctx.services.admin.createProduct.mockResolvedValue({ id: 1, ...payload });

    const res = await ctx.request
      .post('/api/admin/products')
      .set('Authorization', bearer(ctx.adminToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.admin.createProduct).toHaveBeenCalledWith(payload, undefined);
  });

  it('API-P2-011 PATCH /api/admin/products/:id updates product', async () => {
    const payload = { stok: 7 };
    ctx.services.admin.updateProduct.mockResolvedValue({ id: 1, stok: 7 });

    const res = await ctx.request
      .patch('/api/admin/products/1')
      .set('Authorization', bearer(ctx.adminToken))
      .send(payload);

    expect(res.status).toBe(200);
    expect(ctx.services.admin.updateProduct).toHaveBeenCalledWith('1', payload, undefined);
  });

  it('API-P2-012 DELETE /api/admin/products/:id deactivates product', async () => {
    ctx.services.admin.deleteProduct.mockResolvedValue({ id: 1, isActive: false });

    const res = await ctx.request
      .delete('/api/admin/products/1')
      .set('Authorization', bearer(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(ctx.services.admin.deleteProduct).toHaveBeenCalledWith('1');
  });

  it('API-P2-013 GET /api/admin/nutritionists lists nutritionists', async () => {
    ctx.services.admin.getNutritionists.mockResolvedValue({ data: [{ id: 2 }] });

    const res = await ctx.request
      .get('/api/admin/nutritionists')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ search: 'gizi', isAvailable: 'true' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getNutritionists).toHaveBeenCalledWith({
      search: 'gizi',
      isAvailable: 'true',
    });
  });

  it('API-P2-014 POST /api/admin/nutritionists creates nutritionist', async () => {
    const payload = { nama: 'Dr. Gizi', email: 'gizi@example.com', password: 'Password1' };
    ctx.services.admin.createNutritionist.mockResolvedValue({ id: 2, nama: 'Dr. Gizi' });

    const res = await ctx.request
      .post('/api/admin/nutritionists')
      .set('Authorization', bearer(ctx.adminToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.admin.createNutritionist).toHaveBeenCalledWith(payload);
  });

  it('API-P2-015 PATCH /api/admin/nutritionists/:id updates nutritionist', async () => {
    ctx.services.admin.updateNutritionist.mockResolvedValue({ id: 2, nama: 'Dr. Baru' });

    const res = await ctx.request
      .patch('/api/admin/nutritionists/2')
      .set('Authorization', bearer(ctx.adminToken))
      .send({ nama: 'Dr. Baru' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.updateNutritionist).toHaveBeenCalledWith('2', { nama: 'Dr. Baru' });
  });

  it('API-P2-016 DELETE /api/admin/nutritionists/:id deletes nutritionist', async () => {
    ctx.services.admin.deleteNutritionist.mockResolvedValue({ id: 2 });

    const res = await ctx.request
      .delete('/api/admin/nutritionists/2')
      .set('Authorization', bearer(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(ctx.services.admin.deleteNutritionist).toHaveBeenCalledWith('2');
  });

  it('API-P2-017 GET /api/admin/articles lists articles', async () => {
    ctx.services.admin.getArticles.mockResolvedValue({ data: [{ id: 3 }] });

    const res = await ctx.request
      .get('/api/admin/articles')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ kategori: 'MPASI', status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getArticles).toHaveBeenCalledWith({
      kategori: 'MPASI',
      status: 'PUBLISHED',
    });
  });

  it('API-P2-018 POST /api/admin/articles creates article', async () => {
    const payload = { judul: 'MPASI', kategori: 'MPASI', status: 'DRAFT' };
    ctx.services.admin.createArticle.mockResolvedValue({ id: 3, ...payload });

    const res = await ctx.request
      .post('/api/admin/articles')
      .set('Authorization', bearer(ctx.adminToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(ctx.services.admin.createArticle).toHaveBeenCalledWith(payload, undefined);
  });

  it('API-P2-019 PATCH /api/admin/articles/:id updates article', async () => {
    ctx.services.admin.updateArticle.mockResolvedValue({ id: 3, status: 'PUBLISHED' });

    const res = await ctx.request
      .patch('/api/admin/articles/3')
      .set('Authorization', bearer(ctx.adminToken))
      .send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.updateArticle).toHaveBeenCalledWith('3', { status: 'PUBLISHED' }, undefined);
  });

  it('API-P2-020 DELETE /api/admin/articles/:id deletes article', async () => {
    ctx.services.admin.deleteArticle.mockResolvedValue({ id: 3 });

    const res = await ctx.request
      .delete('/api/admin/articles/3')
      .set('Authorization', bearer(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(ctx.services.admin.deleteArticle).toHaveBeenCalledWith('3');
  });

  it('API-P2-021 GET /api/admin/orders/shop lists shop orders', async () => {
    ctx.services.admin.getShopOrders.mockResolvedValue({ data: [{ id: 4 }] });

    const res = await ctx.request
      .get('/api/admin/orders/shop')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ statusBayar: 'PENDING' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getShopOrders).toHaveBeenCalledWith({ statusBayar: 'PENDING' });
  });

  it('API-P2-022 PATCH /api/admin/orders/shop/:id/status updates order status', async () => {
    ctx.services.admin.updateShopOrderStatus.mockResolvedValue({ id: 4, statusBayar: 'SUCCESS' });

    const res = await ctx.request
      .patch('/api/admin/orders/shop/4/status')
      .set('Authorization', bearer(ctx.adminToken))
      .send({ statusBayar: 'SUCCESS' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.updateShopOrderStatus).toHaveBeenCalledWith('4', {
      statusBayar: 'SUCCESS',
    });
  });

  it('API-P2-023 GET /api/admin/consultations lists consultations', async () => {
    ctx.services.admin.getConsultations.mockResolvedValue({ data: [{ id: 5 }] });

    const res = await ctx.request
      .get('/api/admin/consultations')
      .set('Authorization', bearer(ctx.adminToken))
      .query({ status: 'BOOKED', metode: 'VIDEO_CALL' });

    expect(res.status).toBe(200);
    expect(ctx.services.admin.getConsultations).toHaveBeenCalledWith({
      status: 'BOOKED',
      metode: 'VIDEO_CALL',
    });
  });

  it('API-P2-024 PATCH /api/admin/consultations/:id updates consultation', async () => {
    const payload = { status: 'CONFIRMED', linkMeeting: 'https://meet.example.com/abc' };
    ctx.services.admin.updateConsultation.mockResolvedValue({ id: 5, ...payload });

    const res = await ctx.request
      .patch('/api/admin/consultations/5')
      .set('Authorization', bearer(ctx.adminToken))
      .send(payload);

    expect(res.status).toBe(200);
    expect(ctx.services.admin.updateConsultation).toHaveBeenCalledWith('5', payload);
  });
});
