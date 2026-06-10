import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let articleService;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    artikelEdukasi: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const publishedArticle = {
  id: 1,
  judul: 'MPASI Sehat',
  konten: JSON.stringify({
    intro: 'Panduan MPASI sehat untuk anak.',
    sections: [{ text: 'Isi artikel singkat.' }],
  }),
  kategori: 'MPASI',
  gambarUrl: 'mpasi.jpg',
  penulis: 'Tim NutriGrow',
  publishedAt: new Date('2026-05-25T00:00:00.000Z'),
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const servicePath = require.resolve('../../services/article.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };

  articleService = require('../../services/article.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  loadService();
});

describe('articleService.getArticles', () => {
  it('returns published articles with category/search filters and pagination', async () => {
    prisma.artikelEdukasi.findMany.mockResolvedValue([publishedArticle]);
    prisma.artikelEdukasi.count.mockResolvedValue(1);

    const result = await articleService.getArticles({
      kategori: 'Kehamilan',
      search: 'nutrisi',
      page: 2,
      limit: 3,
    });

    expect(result).toMatchObject({
      total: 1,
      page: 2,
      totalPages: 1,
      articles: [
        expect.objectContaining({
          id: 1,
          title: 'MPASI Sehat',
          category: 'MPASI',
          author: 'Tim NutriGrow',
        }),
      ],
    });
    expect(prisma.artikelEdukasi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          kategori: 'KEHAMILAN',
          OR: expect.any(Array),
        }),
        skip: 3,
        take: 3,
      }),
    );
  });
});

describe('articleService.getArticleById', () => {
  it('returns published article detail with parsed content', async () => {
    prisma.artikelEdukasi.findFirst.mockResolvedValue(publishedArticle);

    const result = await articleService.getArticleById(1);

    expect(result).toMatchObject({
      id: 1,
      title: 'MPASI Sehat',
      content: {
        intro: 'Panduan MPASI sehat untuk anak.',
      },
    });
    expect(prisma.artikelEdukasi.findFirst).toHaveBeenCalledWith({
      where: { id: 1, isPublished: true },
    });
  });

  it('rejects missing or unpublished article', async () => {
    prisma.artikelEdukasi.findFirst.mockResolvedValue(null);

    await expect(articleService.getArticleById(99)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Artikel tidak ditemukan',
    });
  });
});

describe('articleService.getRelatedArticles', () => {
  it('returns related published articles in the same category excluding current article', async () => {
    prisma.artikelEdukasi.findUnique.mockResolvedValue({ kategori: 'MPASI' });
    prisma.artikelEdukasi.findMany.mockResolvedValue([{ ...publishedArticle, id: 2 }]);

    const result = await articleService.getRelatedArticles(1);

    expect(result).toEqual([
      expect.objectContaining({
        id: 2,
        title: 'MPASI Sehat',
      }),
    ]);
    expect(prisma.artikelEdukasi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isPublished: true,
          kategori: 'MPASI',
          id: { not: 1 },
        },
        take: 6,
      }),
    );
  });
});

