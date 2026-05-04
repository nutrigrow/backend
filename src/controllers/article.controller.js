const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/responseHelper');
const articleService = require('../services/article.service');

/**
 * @desc    Get paginated list of articles with optional filter & search
 * @route   GET /api/articles?kategori=MPASI&search=&page=1&limit=9
 * @access  Public
 */
const getArticles = catchAsync(async (req, res) => {
  const { kategori, search, page, limit } = req.query;
  const result = await articleService.getArticles({ kategori, search, page, limit });

  success(res, {
    message: 'Daftar artikel berhasil diambil',
    data: result,
  });
});

/**
 * @desc    Get article detail by ID
 * @route   GET /api/articles/:id
 * @access  Public
 */
const getArticleById = catchAsync(async (req, res) => {
  const article = await articleService.getArticleById(req.params.id);

  success(res, {
    message: 'Artikel berhasil diambil',
    data: article,
  });
});

/**
 * @desc    Get related articles (same category, excluding current)
 * @route   GET /api/articles/:id/related
 * @access  Public
 */
const getRelatedArticles = catchAsync(async (req, res) => {
  const articles = await articleService.getRelatedArticles(req.params.id);

  success(res, {
    message: 'Artikel terkait berhasil diambil',
    data: articles,
  });
});

module.exports = { getArticles, getArticleById, getRelatedArticles };
