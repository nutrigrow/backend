const express = require('express');
const router = express.Router();
const nutrishopController = require('../controllers/nutrishop.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');

// All routes in here require authentication
router.use(authenticate);

// ============================================
// PRODUCT ROUTES
// ============================================

// GET /api/products
router.get('/products', nutrishopController.getProducts);

// GET /api/products/:id
router.get('/products/:id', nutrishopController.getProductById);

// POST /api/products (Hanya untuk Admin)
router.post(
    '/products',
    authorize('ADMIN'),
    upload.single('gambar'),
    nutrishopController.addProduct
);


// ============================================
// CART ROUTES (Protected)
// ============================================

// GET /api/cart
router.get('/cart', nutrishopController.getCart);

// POST /api/cart
router.post('/cart', nutrishopController.addToCart);

// ============================================
// ADDRESS ROUTES (Protected)
// ============================================

// POST /api/addresses
router.post('/addresses', nutrishopController.addAddress);

// GET /api/addresses
router.get('/addresses', nutrishopController.getAddresses);

// ============================================
// CHECKOUT ROUTES (Protected)
// ============================================

// POST /api/checkout/cart
router.post('/checkout/cart', nutrishopController.checkoutCart);

// POST /api/checkout/direct
router.post('/checkout/direct', nutrishopController.checkoutDirect);

module.exports = router;
