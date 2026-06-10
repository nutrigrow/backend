import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, createApiTestContext } from '../helpers/apiTestUtils.js';

describe('Article API', () => {
  let ctx;

  beforeEach(() => {
    ctx = createApiTestContext();
  });

  it('API-P2-001 GET /api/articles returns public published articles with filters', async () => {
    ctx.services.article.getArticles.mockResolvedValue({
      data: [{ id: 1, judul: 'MPASI Sehat', status: 'PUBLISHED' }],
      pagination: { page: 1 },
    });

    const res = await ctx.request
      .get('/api/articles')
      .query({ kategori: 'MPASI', search: 'sehat', page: '1', limit: '9' });

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(ctx.services.article.getArticles).toHaveBeenCalledWith({
      kategori: 'MPASI',
      search: 'sehat',
      page: '1',
      limit: '9',
    });
  });

  it('API-P2-002 GET /api/articles/:id returns published article detail', async () => {
    ctx.services.article.getArticleById.mockResolvedValue({
      id: 1,
      judul: 'MPASI Sehat',
      status: 'PUBLISHED',
    });

    const res = await ctx.request.get('/api/articles/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 1, judul: 'MPASI Sehat', status: 'PUBLISHED' });
    expect(ctx.services.article.getArticleById).toHaveBeenCalledWith('1');
  });

  it('API-P2-002 GET /api/articles/:id returns 404 for missing or unpublished article', async () => {
    ctx.services.article.getArticleById.mockRejectedValue(ApiError.notFound('Artikel tidak ditemukan'));

    const res = await ctx.request.get('/api/articles/404');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Artikel tidak ditemukan');
  });

  it('API-P2-003 GET /api/articles/:id/related returns related articles', async () => {
    ctx.services.article.getRelatedArticles.mockResolvedValue([{ id: 2, kategori: 'MPASI' }]);

    const res = await ctx.request.get('/api/articles/1/related');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 2, kategori: 'MPASI' }]);
    expect(ctx.services.article.getRelatedArticles).toHaveBeenCalledWith('1');
  });

  it('API-P2-004 GET /api/hello returns health check response', async () => {
    const res = await ctx.request.get('/api/hello').set('Authorization', `Bearer ${ctx.userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'success',
      message: 'Hello from NutriGrow API!',
    });
  });
});
