const nutrishopService = require('../services/nutrishop.service');

// ============================================
// PRODUCT CONTROLLERS
// ============================================
const getProducts = async (req, res, next) => {
    try {
        const filters = {
            search: req.query.search,
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice,
            kategori: req.query.kategori
        };

        const products = await nutrishopService.getProducts(filters);
        res.status(200).json({
            status: 'success',
            data: { products }
        });
    } catch (error) {
        next(error);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const product = await nutrishopService.getProductById(req.params.id);
        res.status(200).json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        next(error);
    }
};

const addProduct = async (req, res, next) => {
    try {
        const product = await nutrishopService.addProduct(req.body, req.file);
        res.status(201).json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CART CONTROLLERS
// ============================================
const getCart = async (req, res, next) => {
    try {
        const cart = await nutrishopService.getCart(req.user.id);
        res.status(200).json({
            status: 'success',
            data: { cart }
        });
    } catch (error) {
        next(error);
    }
};

const addToCart = async (req, res, next) => {
    try {
        const cartItem = await nutrishopService.addToCart(req.user.id, req.body);
        res.status(201).json({
            status: 'success',
            data: { cartItem }
        });
    } catch (error) {
        next(error);
    }
};

const updateCartItemQuantity = async (req, res, next) => {
    try {
        const cartItem = await nutrishopService.updateCartItemQuantity(req.user.id, req.params.id, req.body);
        res.status(200).json({
            status: 'success',
            data: { cartItem }
        });
    } catch (error) {
        next(error);
    }
};

const deleteCartItem = async (req, res, next) => {
    try {
        const deleted = await nutrishopService.deleteCartItem(req.user.id, req.params.id);
        res.status(200).json({
            status: 'success',
            data: { deleted }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// ADDRESS CONTROLLERS
// ============================================
const addAddress = async (req, res, next) => {
    try {
        const address = await nutrishopService.addAddress(req.user.id, req.body);
        res.status(201).json({
            status: 'success',
            data: { address }
        });
    } catch (error) {
        next(error);
    }
};

const getAddresses = async (req, res, next) => {
    try {
        const addresses = await nutrishopService.getAddresses(req.user.id);
        res.status(200).json({
            status: 'success',
            data: { addresses }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CHECKOUT CONTROLLERS
// ============================================
const checkoutCart = async (req, res, next) => {
    try {
        const transaction = await nutrishopService.checkoutCart(req.user.id, req.body);
        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        next(error);
    }
};

const checkoutDirect = async (req, res, next) => {
    try {
        const transaction = await nutrishopService.checkoutDirect(req.user.id, req.body);
        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// ORDER CONTROLLERS
// ============================================
const getOrders = async (req, res, next) => {
    try {
        const orders = await nutrishopService.getOrders(req.user.id, req.query);
        res.status(200).json({
            status: 'success',
            data: { orders }
        });
    } catch (error) {
        next(error);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const order = await nutrishopService.getOrderById(req.user.id, req.params.id);
        res.status(200).json({
            status: 'success',
            data: { order }
        });
    } catch (error) {
        next(error);
    }
};

const syncOrderPayment = async (req, res, next) => {
    try {
        const order = await nutrishopService.syncOrderPaymentStatus(req.user.id, req.params.id);
        res.status(200).json({
            status: 'success',
            data: { order }
        });
    } catch (error) {
        next(error);
    }
};

const payOrder = async (req, res, next) => {
    try {
        const order = await nutrishopService.createPaymentForOrder(req.user.id, req.params.id);
        res.status(200).json({
            status: 'success',
            data: { order }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// MIDTRANS WEBHOOK CONTROLLER
// ============================================
const handleMidtransWebhook = async (req, res, next) => {
    try {
        const order = await nutrishopService.handleMidtransWebhook(req.body);
        res.status(200).json({
            status: 'success',
            data: { order }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProducts,
    getProductById,
    addProduct,
    getCart,
    addToCart,
    updateCartItemQuantity,
    deleteCartItem,
    addAddress,
    getAddresses,
    getOrders,
    getOrderById,
    syncOrderPayment,
    payOrder,
    handleMidtransWebhook,
    checkoutCart,
    checkoutDirect
};
