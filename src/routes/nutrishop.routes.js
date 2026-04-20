const express = require('express');
const router = express.Router();
const nutrishopController = require('../controllers/nutrishop.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');

// Midtrans webhook must be public (no JWT)
router.post('/midtrans/webhook', nutrishopController.handleMidtransWebhook);

// All routes below require authentication
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

// PATCH /api/cart/:id
router.patch('/cart/:id', nutrishopController.updateCartItemQuantity);

// DELETE /api/cart/:id
router.delete('/cart/:id', nutrishopController.deleteCartItem);

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

// ============================================
// ORDER ROUTES (Protected)
// ============================================

// GET /api/orders
router.get('/orders', nutrishopController.getOrders);

// GET /api/orders/:id
router.get('/orders/:id', nutrishopController.getOrderById);

// POST /api/orders/:id/pay
router.post('/orders/:id/pay', nutrishopController.payOrder);

// POST /api/orders/:id/sync-payment
router.post('/orders/:id/sync-payment', nutrishopController.syncOrderPayment);

module.exports = router;
