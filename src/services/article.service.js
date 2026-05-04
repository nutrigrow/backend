const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

// ─── Category Mappings ────────────────────────────────────────────────────────

const CATEGORY_TO_DB = {
  'MPASI': 'MPASI',
  'Kehamilan': 'KEHAMILAN',
  'Menyusui': 'MENYUSUI',
  'Tumbuh Kembang': 'GIZI',   // no TUMBUH_KEMBANG enum, maps to GIZI
};

const CATEGORY_TO_DISPLAY = {
  MPASI: 'MPASI',
  KEHAMILAN: 'Kehamilan',
  MENYUSUI: 'Menyusui',
  GIZI: 'Tumbuh Kembang',
  STUNTING: 'Stunting',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count total words in a parsed konten object (intro + all section texts/items)
 */
function countWords(str = '') {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function computeReadTime(konten) {
  try {
    const parsed = typeof konten === 'string' ? JSON.parse(konten) : konten;
    let words = countWords(parsed.intro || '');

    for (const section of parsed.sections || []) {
      if (section.text) words += countWords(section.text);
      if (Array.isArray(section.items)) {
        for (const item of section.items) {
          if (item.text)  words += countWords(item.text);
          if (item.label) words += countWords(item.label);
        }
      }
    }

    return Math.max(1, Math.round(words / 200));
  } catch {
    return 5;
  }
}

function extractDescription(konten, maxLen = 180) {
  try {
    const parsed = typeof konten === 'string' ? JSON.parse(konten) : konten;
    const intro = parsed.intro || '';
    return intro.length > maxLen ? intro.slice(0, maxLen).trimEnd() + '...' : intro;
  } catch {
    return '';
  }
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Transform a DB ArtikelEdukasi record to the frontend Article shape
 */
function formatArticle(article) {
  return {
    id: article.id,
    title: article.judul,
    description: extractDescription(article.konten),
    category: CATEGORY_TO_DISPLAY[article.kategori] ?? article.kategori,
    image: article.gambarUrl ?? null,
    author: article.penulis ?? 'Tim NutriGrow',
    date: formatDate(article.publishedAt),
    readTime: computeReadTime(article.konten),
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * List articles with optional category filter, search, and pagination
 */
const getArticles = async ({ kategori, search, page = 1, limit = 9 } = {}) => {
  const where = { isPublished: true };

  if (kategori && kategori !== 'Semua') {
    const dbKategori = CATEGORY_TO_DB[kategori];
    if (dbKategori) where.kategori = dbKategori;
  }

  if (search && search.trim()) {
    where.OR = [
      { judul:    { contains: search.trim(), mode: 'insensitive' } },
      { penulis:  { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [articles, total] = await Promise.all([
    prisma.artikelEdukasi.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.artikelEdukasi.count({ where }),
  ]);

  return {
    articles: articles.map(formatArticle),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get a single article by ID, including parsed rich-text content
 */
const getArticleById = async (id) => {
  const article = await prisma.artikelEdukasi.findFirst({
    where: { id: Number(id), isPublished: true },
  });

  if (!article) throw ApiError.notFound('Artikel tidak ditemukan');

  let content = { intro: '', sections: [] };
  try {
    content = JSON.parse(article.konten);
  } catch {
    content = { intro: article.konten, sections: [] };
  }

  return {
    ...formatArticle(article),
    content,
  };
};

/**
 * Get articles related to the given article (same category, excluding itself)
 */
const getRelatedArticles = async (id) => {
  const article = await prisma.artikelEdukasi.findUnique({
    where: { id: Number(id) },
    select: { kategori: true },
  });

  if (!article) return [];

  const related = await prisma.artikelEdukasi.findMany({
    where: {
      isPublished: true,
      kategori: article.kategori,
      id: { not: Number(id) },
    },
    orderBy: { publishedAt: 'desc' },
    take: 6,
  });

  return related.map(formatArticle);
};

module.exports = { getArticles, getArticleById, getRelatedArticles };
