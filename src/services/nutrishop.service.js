const crypto = require('crypto');
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const midtransClient = require('midtrans-client');
const { compressAndSaveProductImage } = require('../utils/imageCompressor');

const SHIPPING_COSTS = {
    STANDARD: 5000,
    EXPRESS: 15000
};

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MIDTRANS_READY = Boolean(MIDTRANS_SERVER_KEY && MIDTRANS_CLIENT_KEY);

const ORDER_INCLUDE = {
    alamat: true,
    detailTransaksi: {
        include: {
            produk: {
                select: {
                    id: true,
                    namaProduk: true,
                    gambarUrl: true,
                    harga: true,
                    kategori: true
                }
            }
        }
    }
};

const RESTORABLE_STATUSES = new Set(['FAILED', 'EXPIRED', 'REFUND']);
const STATUS_BAYAR_VALUES = new Set(['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUND']);

let coreApi = null;
let snap = null;

if (MIDTRANS_READY) {
    try {
        coreApi = new midtransClient.CoreApi({
            isProduction: MIDTRANS_IS_PRODUCTION,
            serverKey: MIDTRANS_SERVER_KEY,
            clientKey: MIDTRANS_CLIENT_KEY
        });

        snap = new midtransClient.Snap({
            isProduction: MIDTRANS_IS_PRODUCTION,
            serverKey: MIDTRANS_SERVER_KEY,
            clientKey: MIDTRANS_CLIENT_KEY
        });
    } catch (error) {
        console.error('Midtrans initialization error:', error.message);
    }
} else {
    console.warn('Midtrans is not configured. Set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY to enable payments.');
}

const parsePositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw ApiError.badRequest(`${fieldName} must be a positive integer`);
    }
    return parsed;
};

const parseShippingMethod = (rawValue) => {
    const method = String(rawValue || '').toUpperCase();
    if (!SHIPPING_COSTS[method]) {
        throw ApiError.badRequest('Invalid metodePengiriman');
    }
    return method;
};

const serializeOrder = (order, extra = {}) => {
    const items = (order.detailTransaksi || []).map((item) => ({
        id: item.id,
        produkId: item.produkId,
        kuantitas: item.kuantitas,
        hargaSatuan: item.hargaSatuan,
        subtotal: item.subtotal,
        produk: item.produk
            ? {
                  id: item.produk.id,
                  namaProduk: item.produk.namaProduk,
                  gambarUrl: item.produk.gambarUrl,
                  harga: item.produk.harga,
                  kategori: item.produk.kategori
              }
            : null
    }));

    return {
        id: order.id,
        midtransOrderId: order.midtransOrderId,
        midtransTransactionId: order.midtransTransactionId,
        jenisTransaksi: order.jenisTransaksi,
        statusBayar: order.statusBayar,
        totalHarga: order.totalHarga,
        biayaPengiriman: order.biayaPengiriman,
        metodePengiriman: order.metodePengiriman,
        snapToken: order.snapToken,
        snapRedirectUrl: extra.snapRedirectUrl || null,
        paymentType: order.paymentType,
        tanggalTransaksi: order.tanggalTransaksi,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        itemCount: items.reduce((sum, item) => sum + item.kuantitas, 0),
        items,
        alamat: order.alamat
            ? {
                  id: order.alamat.id,
                  namaPenerima: order.alamat.namaPenerima,
                  noTelepon: order.alamat.noTelepon,
                  alamatLengkap: order.alamat.alamatLengkap,
                  kelurahan: order.alamat.kelurahan,
                  kecamatan: order.alamat.kecamatan,
                  kota: order.alamat.kota,
                  kodePos: order.alamat.kodePos,
                  isUtama: order.alamat.isUtama
              }
            : null,
        paymentGatewayConfigured: MIDTRANS_READY,
        midtransClientKey: MIDTRANS_CLIENT_KEY || null,
        midtransIsProduction: MIDTRANS_IS_PRODUCTION,
        paymentGatewayError: extra.paymentGatewayError || null
    };
};

const buildMidtransItemDetails = (detailTransaksi, biayaPengiriman) => {
    const items = detailTransaksi.map((item) => ({
        id: String(item.produkId),
        price: item.hargaSatuan,
        quantity: item.kuantitas,
        name: item.produk?.namaProduk || `Produk ${item.produkId}`
    }));

    if (biayaPengiriman > 0) {
        items.push({
            id: 'SHIPPING',
            price: biayaPengiriman,
            quantity: 1,
            name: 'Biaya Pengiriman'
        });
    }

    return items;
};

const createSnapForOrder = async ({ order, user }) => {
    if (!snap) {
        return {
            order,
            snapRedirectUrl: null,
            paymentGatewayError: 'Midtrans belum dikonfigurasi di server'
        };
    }

    if (!order.alamat) {
        return {
            order,
            snapRedirectUrl: null,
            paymentGatewayError: 'Alamat pengiriman tidak ditemukan untuk transaksi ini'
        };
    }

    try {
        const parameter = {
            transaction_details: {
                order_id: order.midtransOrderId,
                gross_amount: order.totalHarga
            },
            item_details: buildMidtransItemDetails(order.detailTransaksi || [], order.biayaPengiriman),
            customer_details: {
                first_name: user.nama?.split(' ')[0] || user.nama,
                last_name: user.nama?.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone: order.alamat.noTelepon,
                billing_address: {
                    first_name: order.alamat.namaPenerima,
                    phone: order.alamat.noTelepon,
                    address: order.alamat.alamatLengkap,
                    city: order.alamat.kota,
                    postal_code: order.alamat.kodePos,
                    country_code: 'IDN'
                },
                shipping_address: {
                    first_name: order.alamat.namaPenerima,
                    phone: order.alamat.noTelepon,
                    address: order.alamat.alamatLengkap,
                    city: order.alamat.kota,
                    postal_code: order.alamat.kodePos,
                    country_code: 'IDN'
                }
            }
        };

        const snapResponse = await snap.createTransaction(parameter);

        const updatedOrder = await prisma.transaksi.update({
            where: { id: order.id },
            data: { snapToken: snapResponse.token },
            include: ORDER_INCLUDE
        });

        return {
            order: updatedOrder,
            snapRedirectUrl: snapResponse.redirect_url || null,
            paymentGatewayError: null
        };
    } catch (error) {
        console.error('Midtrans Snap Error:', error);
        return {
            order,
            snapRedirectUrl: null,
            paymentGatewayError: error?.message || 'Gagal membuat transaksi Midtrans'
        };
    }
};

const mapMidtransStatusToStatusBayar = (transactionStatus, fraudStatus) => {
    const status = String(transactionStatus || '').toLowerCase();

    if (status === 'capture') {
        return String(fraudStatus || '').toLowerCase() === 'accept' ? 'SUCCESS' : 'PENDING';
    }

    if (status === 'settlement') return 'SUCCESS';
    if (status === 'pending') return 'PENDING';
    if (status === 'expire') return 'EXPIRED';
    if (status === 'refund' || status === 'partial_refund' || status === 'chargeback') return 'REFUND';
    if (status === 'cancel' || status === 'deny' || status === 'failure') return 'FAILED';

    return 'PENDING';
};

const updatePaymentStatusByOrderId = async ({
    orderId,
    transactionStatus,
    fraudStatus,
    midtransTransactionId,
    paymentType
}) => {
    const targetOrderId = String(orderId || '').trim();

    if (!targetOrderId) {
        throw ApiError.badRequest('order_id is required');
    }

    const nextStatusBayar = mapMidtransStatusToStatusBayar(transactionStatus, fraudStatus);

    const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.transaksi.findUnique({
            where: { midtransOrderId: targetOrderId },
            include: ORDER_INCLUDE
        });

        if (!existing) {
            throw ApiError.notFound('Order not found');
        }

        const shouldRestoreStock =
            existing.statusBayar === 'PENDING' && RESTORABLE_STATUSES.has(nextStatusBayar);

        if (shouldRestoreStock) {
            for (const item of existing.detailTransaksi) {
                await tx.produkNutrishop.update({
                    where: { id: item.produkId },
                    data: { stok: { increment: item.kuantitas } }
                });
            }
        }

        const order = await tx.transaksi.update({
            where: { id: existing.id },
            data: {
                statusBayar: nextStatusBayar,
                midtransTransactionId: midtransTransactionId || existing.midtransTransactionId,
                paymentType: paymentType || existing.paymentType,
                paidAt: nextStatusBayar === 'SUCCESS' ? new Date() : existing.paidAt
            },
            include: ORDER_INCLUDE
        });

        // SPECIAL HANDLING: If Tele-Nutritionist payment is SUCCESS, update consultation status
        if (nextStatusBayar === 'SUCCESS' && existing.jenisTransaksi === 'TELE_NUTRITIONIST') {
            await tx.konsultasi.update({
                where: { transaksiId: existing.id },
                data: { status: 'CONFIRMED' }
            });
        }

        return order;
    });

    return serializeOrder(updated);
};

const verifyMidtransSignature = ({ orderId, statusCode, grossAmount, signatureKey }) => {
    if (!MIDTRANS_SERVER_KEY) {
        throw ApiError.badRequest('Midtrans server key is not configured');
    }

    const payload = `${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`;
    const expected = crypto.createHash('sha512').update(payload).digest('hex');
    return expected === String(signatureKey || '');
};

const validateProductStock = async (productId, quantity) => {
    const product = await prisma.produkNutrishop.findUnique({
        where: { id: productId }
    });

    if (!product || !product.isActive) {
        throw ApiError.notFound('Product not found');
    }

    if (product.stok < quantity) {
        throw ApiError.badRequest(`Insufficient stock for product: ${product.namaProduk}`);
    }

    return product;
};

// ============================================
// PRODUCT SERVICES
// ============================================
const getProducts = async (filters) => {
    const { search, minPrice, maxPrice, kategori } = filters;

    const where = {
        isActive: true
    };

    if (search) {
        where.namaProduk = {
            contains: search,
            mode: 'insensitive'
        };
    }

    if (minPrice || maxPrice) {
        where.harga = {};
        if (minPrice) where.harga.gte = parseInt(minPrice, 10);
        if (maxPrice) where.harga.lte = parseInt(maxPrice, 10);
    }

    if (kategori) {
        where.kategori = kategori;
    }

    return prisma.produkNutrishop.findMany({
        where,
        select: {
            id: true,
            namaProduk: true,
            deskripsi: true,
            harga: true,
            gambarUrl: true,
            stok: true,
            kategori: true
        }
    });
};

const getProductById = async (id) => {
    const productId = parsePositiveInt(id, 'id');

    const product = await prisma.produkNutrishop.findUnique({
        where: { id: productId }
    });

    if (!product || !product.isActive) {
        throw ApiError.notFound('Product not found');
    }

    return product;
};

const addProduct = async (data, file) => {
    const harga = parsePositiveInt(data.harga, 'harga');
    const stok = parsePositiveInt(data.stok, 'stok');

    let gambarUrl = null;

    if (file) {
        const prefix = data.namaProduk.replace(/\s+/g, '-').toLowerCase();
        gambarUrl = await compressAndSaveProductImage(file.buffer, prefix);
    }

    return prisma.produkNutrishop.create({
        data: {
            namaProduk: data.namaProduk,
            deskripsi: data.deskripsi,
            kategori: data.kategori,
            harga,
            stok,
            gambarUrl
        }
    });
};

// ============================================
// CART SERVICES
// ============================================
const getCart = async (userId) => {
    return prisma.keranjang.findMany({
        where: { userId },
        include: {
            produk: {
                select: {
                    id: true,
                    namaProduk: true,
                    harga: true,
                    gambarUrl: true,
                    stok: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });
};

const addToCart = async (userId, data) => {
    const produkId = parsePositiveInt(data.produkId, 'produkId');
    const kuantitas = parsePositiveInt(data.kuantitas, 'kuantitas');

    const product = await validateProductStock(produkId, kuantitas);

    const existingCartItem = await prisma.keranjang.findFirst({
        where: {
            userId,
            produkId
        }
    });

    if (existingCartItem) {
        const nextQty = existingCartItem.kuantitas + kuantitas;
        if (product.stok < nextQty) {
            throw ApiError.badRequest('Kuantitas exceeds product stock');
        }

        return prisma.keranjang.update({
            where: { id: existingCartItem.id },
            data: { kuantitas: nextQty },
            include: {
                produk: {
                    select: {
                        id: true,
                        namaProduk: true,
                        harga: true,
                        gambarUrl: true,
                        stok: true
                    }
                }
            }
        });
    }

    return prisma.keranjang.create({
        data: {
            userId,
            produkId,
            kuantitas
        },
        include: {
            produk: {
                select: {
                    id: true,
                    namaProduk: true,
                    harga: true,
                    gambarUrl: true,
                    stok: true
                }
            }
        }
    });
};

const updateCartItemQuantity = async (userId, cartItemId, data) => {
    const itemId = parsePositiveInt(cartItemId, 'cartItemId');
    const kuantitas = parsePositiveInt(data.kuantitas, 'kuantitas');

    const cartItem = await prisma.keranjang.findFirst({
        where: { id: itemId, userId },
        include: { produk: true }
    });

    if (!cartItem) {
        throw ApiError.notFound('Cart item not found');
    }

    if (!cartItem.produk || !cartItem.produk.isActive) {
        throw ApiError.notFound('Product not found');
    }

    if (cartItem.produk.stok < kuantitas) {
        throw ApiError.badRequest('Kuantitas exceeds product stock');
    }

    return prisma.keranjang.update({
        where: { id: itemId },
        data: { kuantitas },
        include: {
            produk: {
                select: {
                    id: true,
                    namaProduk: true,
                    harga: true,
                    gambarUrl: true,
                    stok: true
                }
            }
        }
    });
};

const deleteCartItem = async (userId, cartItemId) => {
    const itemId = parsePositiveInt(cartItemId, 'cartItemId');

    const cartItem = await prisma.keranjang.findFirst({
        where: { id: itemId, userId }
    });

    if (!cartItem) {
        throw ApiError.notFound('Cart item not found');
    }

    await prisma.keranjang.delete({ where: { id: itemId } });
    return { id: itemId };
};

// ============================================
// ADDRESS SERVICES
// ============================================
const addAddress = async (userId, data) => {
    const { isUtama } = data;

    if (isUtama) {
        await prisma.alamatPengiriman.updateMany({
            where: { userId, isUtama: true },
            data: { isUtama: false }
        });
    }

    return prisma.alamatPengiriman.create({
        data: {
            userId,
            ...data
        }
    });
};

const getAddresses = async (userId) => {
    return prisma.alamatPengiriman.findMany({
        where: { userId },
        orderBy: [{ isUtama: 'desc' }, { createdAt: 'desc' }]
    });
};

// ============================================
// ORDER SERVICES
// ============================================
const getOrders = async (userId, filters = {}) => {
    const where = {
        userId,
        jenisTransaksi: 'SHOP'
    };

    if (filters.statusBayar) {
        const normalized = String(filters.statusBayar).toUpperCase();
        if (!STATUS_BAYAR_VALUES.has(normalized)) {
            throw ApiError.badRequest('Invalid statusBayar filter');
        }
        where.statusBayar = normalized;
    }

    const orders = await prisma.transaksi.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { tanggalTransaksi: 'desc' }
    });

    return orders.map((order) => serializeOrder(order));
};

const getOrderById = async (userId, orderId) => {
    const parsedOrderId = parsePositiveInt(orderId, 'orderId');

    const order = await prisma.transaksi.findFirst({
        where: {
            id: parsedOrderId,
            userId,
            jenisTransaksi: 'SHOP'
        },
        include: ORDER_INCLUDE
    });

    if (!order) {
        throw ApiError.notFound('Order not found');
    }

    return serializeOrder(order);
};

const createPaymentForOrder = async (userId, orderId) => {
    const parsedOrderId = parsePositiveInt(orderId, 'orderId');

    const order = await prisma.transaksi.findFirst({
        where: {
            id: parsedOrderId,
            userId,
            jenisTransaksi: 'SHOP'
        },
        include: ORDER_INCLUDE
    });

    if (!order) {
        throw ApiError.notFound('Order not found');
    }

    if (order.statusBayar !== 'PENDING') {
        throw ApiError.badRequest('Only pending orders can be paid');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw ApiError.notFound('User not found');
    }

    if (order.snapToken) {
        return serializeOrder(order);
    }

    const snapResult = await createSnapForOrder({ order, user });
    return serializeOrder(snapResult.order, {
        snapRedirectUrl: snapResult.snapRedirectUrl,
        paymentGatewayError: snapResult.paymentGatewayError
    });
};

const syncOrderPaymentStatus = async (userId, orderId) => {
    const parsedOrderId = parsePositiveInt(orderId, 'orderId');

    const order = await prisma.transaksi.findFirst({
        where: {
            id: parsedOrderId,
            userId,
            jenisTransaksi: 'SHOP'
        }
    });

    if (!order) {
        throw ApiError.notFound('Order not found');
    }

    if (!coreApi) {
        throw ApiError.badRequest('Midtrans belum dikonfigurasi di server');
    }

    let statusResponse;
    try {
        statusResponse = await coreApi.transaction.status(order.midtransOrderId);
    } catch (error) {
        throw ApiError.badRequest(`Gagal sinkronisasi status Midtrans: ${error.message}`);
    }

    return updatePaymentStatusByOrderId({
        orderId: statusResponse.order_id,
        transactionStatus: statusResponse.transaction_status,
        fraudStatus: statusResponse.fraud_status,
        midtransTransactionId: statusResponse.transaction_id,
        paymentType: statusResponse.payment_type
    });
};

const handleMidtransWebhook = async (payload) => {
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;
    const signatureKey = payload.signature_key;
    const transactionStatus = payload.transaction_status;

    if (!orderId || !statusCode || !grossAmount || !signatureKey || !transactionStatus) {
        throw ApiError.badRequest('Invalid Midtrans notification payload');
    }

    const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey
    });

    if (!isValid) {
        throw ApiError.unauthorized('Invalid Midtrans signature');
    }

    return updatePaymentStatusByOrderId({
        orderId,
        transactionStatus,
        fraudStatus: payload.fraud_status,
        midtransTransactionId: payload.transaction_id,
        paymentType: payload.payment_type
    });
};

// ============================================
// CHECKOUT SERVICES
// ============================================
const checkoutCart = async (userId, data) => {
    const cartItemIds = (data.cartItemIds || []).map((id) => parsePositiveInt(id, 'cartItemIds'));
    const alamatId = parsePositiveInt(data.alamatId, 'alamatId');
    const metodePengiriman = parseShippingMethod(data.metodePengiriman);

    if (cartItemIds.length === 0) {
        throw ApiError.badRequest('Cart items cannot be empty');
    }

    const cartItems = await prisma.keranjang.findMany({
        where: {
            userId,
            id: { in: cartItemIds }
        },
        include: { produk: true }
    });

    if (cartItems.length !== cartItemIds.length) {
        throw ApiError.badRequest('Some cart items are invalid');
    }

    const address = await prisma.alamatPengiriman.findFirst({
        where: { id: alamatId, userId }
    });

    if (!address) {
        throw ApiError.notFound('Address not found or does not belong to user');
    }

    let subtotal = 0;
    const detailTransaksiData = [];

    for (const item of cartItems) {
        if (!item.produk || !item.produk.isActive) {
            throw ApiError.notFound('Product not found');
        }

        if (item.produk.stok < item.kuantitas) {
            throw ApiError.badRequest(`Insufficient stock for product: ${item.produk.namaProduk}`);
        }

        const itemTotal = item.produk.harga * item.kuantitas;
        subtotal += itemTotal;

        detailTransaksiData.push({
            produkId: item.produk.id,
            kuantitas: item.kuantitas,
            hargaSatuan: item.produk.harga,
            subtotal: itemTotal
        });
    }

    const shippingCost = SHIPPING_COSTS[metodePengiriman];
    const totalAmount = subtotal + shippingCost;
    const orderId = `SHOP-${Date.now()}-${userId}`;

    const order = await prisma.$transaction(async (tx) => {
        const created = await tx.transaksi.create({
            data: {
                userId,
                midtransOrderId: orderId,
                jenisTransaksi: 'SHOP',
                totalHarga: totalAmount,
                statusBayar: 'PENDING',
                alamatId,
                metodePengiriman,
                biayaPengiriman: shippingCost,
                detailTransaksi: {
                    create: detailTransaksiData
                }
            },
            include: ORDER_INCLUDE
        });

        for (const item of cartItems) {
            const updatedStock = await tx.produkNutrishop.updateMany({
                where: {
                    id: item.produkId,
                    stok: { gte: item.kuantitas }
                },
                data: {
                    stok: { decrement: item.kuantitas }
                }
            });

            if (updatedStock.count === 0) {
                throw ApiError.badRequest(`Insufficient stock for product: ${item.produk.namaProduk}`);
            }

            await tx.keranjang.delete({
                where: { id: item.id }
            });
        }

        return created;
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw ApiError.notFound('User not found');
    }

    const snapResult = await createSnapForOrder({ order, user });

    return serializeOrder(snapResult.order, {
        snapRedirectUrl: snapResult.snapRedirectUrl,
        paymentGatewayError: snapResult.paymentGatewayError
    });
};

const checkoutDirect = async (userId, data) => {
    const produkId = parsePositiveInt(data.produkId, 'produkId');
    const kuantitas = parsePositiveInt(data.kuantitas, 'kuantitas');
    const alamatId = parsePositiveInt(data.alamatId, 'alamatId');
    const metodePengiriman = parseShippingMethod(data.metodePengiriman);

    const product = await validateProductStock(produkId, kuantitas);

    const address = await prisma.alamatPengiriman.findFirst({
        where: { id: alamatId, userId }
    });

    if (!address) {
        throw ApiError.notFound('Address not found or does not belong to user');
    }

    const subtotal = product.harga * kuantitas;
    const shippingCost = SHIPPING_COSTS[metodePengiriman];
    const totalAmount = subtotal + shippingCost;
    const orderId = `SHOP-${Date.now()}-${userId}`;

    const order = await prisma.$transaction(async (tx) => {
        const created = await tx.transaksi.create({
            data: {
                userId,
                midtransOrderId: orderId,
                jenisTransaksi: 'SHOP',
                totalHarga: totalAmount,
                statusBayar: 'PENDING',
                alamatId,
                metodePengiriman,
                biayaPengiriman: shippingCost,
                detailTransaksi: {
                    create: [
                        {
                            produkId,
                            kuantitas,
                            hargaSatuan: product.harga,
                            subtotal
                        }
                    ]
                }
            },
            include: ORDER_INCLUDE
        });

        const updatedStock = await tx.produkNutrishop.updateMany({
            where: {
                id: produkId,
                stok: { gte: kuantitas }
            },
            data: {
                stok: { decrement: kuantitas }
            }
        });

        if (updatedStock.count === 0) {
            throw ApiError.badRequest(`Insufficient stock for product: ${product.namaProduk}`);
        }

        return created;
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw ApiError.notFound('User not found');
    }

    const snapResult = await createSnapForOrder({ order, user });

    return serializeOrder(snapResult.order, {
        snapRedirectUrl: snapResult.snapRedirectUrl,
        paymentGatewayError: snapResult.paymentGatewayError
    });
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
    createPaymentForOrder,
    syncOrderPaymentStatus,
    handleMidtransWebhook,
    checkoutCart,
    checkoutDirect
};
