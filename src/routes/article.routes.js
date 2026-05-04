const express = require('express');
const router = express.Router();
const articleController = require('../controllers/article.controller');

// All article routes are public (no auth required)
router.get('/', articleController.getArticles);
router.get('/:id/related', articleController.getRelatedArticles); // must be before /:id
router.get('/:id', articleController.getArticleById);

module.exports = router;
