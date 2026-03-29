const { PrismaClient } = require('@prisma/client');
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const midtransClient = require('midtrans-client');
const { compressAndSaveProductImage } = require('../utils/imageCompressor');

const SHIPPING_COSTS = {
    STANDARD: 5000,
    EXPRESS: 15000
};

// ============================================
// MIDTRANS CONFIGURATION
// ============================================
let coreApi;
let snap;

try {
    coreApi = new midtransClient.CoreApi({
        isProduction: process.env.NODE_ENV === 'production',
        serverKey: process.env.MIDTRANS_SERVER_KEY || 'dummy_server_key',
        clientKey: process.env.MIDTRANS_CLIENT_KEY || 'dummy_client_key'
    });

    snap = new midtransClient.Snap({
        isProduction: process.env.NODE_ENV === 'production',
        serverKey: process.env.MIDTRANS_SERVER_KEY || 'dummy_server_key',
        clientKey: process.env.MIDTRANS_CLIENT_KEY || 'dummy_client_key'
    });
} catch (error) {
    console.error('Midtrans initialization error: ', error.message);
}

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
        if (minPrice) where.harga.gte = parseInt(minPrice);
        if (maxPrice) where.harga.lte = parseInt(maxPrice);
    }

    if (kategori) {
        where.kategori = kategori;
    }

    return await prisma.produkNutrishop.findMany({
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
    const product = await prisma.produkNutrishop.findUnique({
        where: { id: parseInt(id) }
    });

    if (!product || !product.isActive) {
        throw ApiError.notFound('Product not found');
    }

    return product;
};

const addProduct = async (data, file) => {
    // data.harga & data.stok are parsed from Form-Data (string)
    const harga = parseInt(data.harga);
    const stok = parseInt(data.stok);

    if (isNaN(harga) || isNaN(stok)) {
        throw ApiError.badRequest('Harga & Stok must be valid numbers');
    }

    let gambarUrl = null;

    if (file) {
        // Here we compress the Mutler buffer and save to WebP
        const prefix = data.namaProduk.replace(/\s+/g, '-').toLowerCase();
        gambarUrl = await compressAndSaveProductImage(file.buffer, prefix);
    }

    // Insert to DB
    const product = await prisma.produkNutrishop.create({
        data: {
            namaProduk: data.namaProduk,
            deskripsi: data.deskripsi,
            kategori: data.kategori,
            harga,
            stok,
            gambarUrl
        }
    });

    return product;
};

// ============================================
// CART SERVICES
// ============================================
const getCart = async (userId) => {
    return await prisma.keranjang.findMany({
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
        }
    });
};

const addToCart = async (userId, data) => {
    const { produkId, kuantitas } = data;

    const product = await prisma.produkNutrishop.findUnique({
        where: { id: parseInt(produkId) }
    });

    if (!product || !product.isActive) {
        throw ApiError.notFound('Product not found');
    }
    
    if (product.stok < kuantitas) {
        throw ApiError.badRequest('Kuantitas exceeds product stock');
    }

    const existingCartItem = await prisma.keranjang.findFirst({
        where: {
            userId,
            produkId: parseInt(produkId)
        }
    });

    if (existingCartItem) {
        return await prisma.keranjang.update({
            where: { id: existingCartItem.id },
            data: { kuantitas: existingCartItem.kuantitas + parseInt(kuantitas) }
        });
    }

    return await prisma.keranjang.create({
        data: {
            userId,
            produkId: parseInt(produkId),
            kuantitas: parseInt(kuantitas)
        }
    });
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

    return await prisma.alamatPengiriman.create({
        data: {
            userId,
            ...data
        }
    });
};

const getAddresses = async (userId) => {
    return await prisma.alamatPengiriman.findMany({
        where: { userId },
        orderBy: { isUtama: 'desc' }
    });
};

// ============================================
// CHECKOUT SERVICES
// ============================================
const checkoutCart = async (userId, data) => {
    const { cartItemIds, alamatId, metodePengiriman } = data;

    if (!cartItemIds || cartItemIds.length === 0) {
        throw ApiError.badRequest('Cart items cannot be empty');
    }

    // 1. Fetch Cart Items
    const cartItems = await prisma.keranjang.findMany({
        where: {
            userId,
            id: { in: cartItemIds.map(id => parseInt(id)) }
        },
        include: { produk: true }
    });

    if (cartItems.length === 0) {
        throw ApiError.badRequest('No valid cart items found');
    }

    // 2. Validate Address
    const address = await prisma.alamatPengiriman.findFirst({
        where: { id: parseInt(alamatId), userId }
    });

    if (!address) {
        throw ApiError.notFound('Address not found or does not belong to user');
    }

    if (!SHIPPING_COSTS[metodePengiriman]) {
        throw ApiError.badRequest('Invalid metodePengiriman');
    }

    // 3. Calculate Totals
    let subtotal = 0;
    const detailTransaksiData = [];

    for (const item of cartItems) {
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

    // 4. Create Transaction
    const transaction = await prisma.$transaction(async (tx) => {
        // Create Transaksi
        const t = await tx.transaksi.create({
            data: {
                userId,
                midtransOrderId: orderId,
                jenisTransaksi: 'SHOP',
                totalHarga: totalAmount,
                statusBayar: 'PENDING',
                alamatId: parseInt(alamatId),
                metodePengiriman,
                biayaPengiriman: shippingCost,
                detailTransaksi: {
                    create: detailTransaksiData
                }
            }
        });

        // Update Stock and Delete Cart Items
        for (const item of cartItems) {
            await tx.produkNutrishop.update({
                where: { id: item.produkId },
                data: { stok: { decrement: item.kuantitas } }
            });
            await tx.keranjang.delete({
                where: { id: item.id }
            });
        }
        return t;
    });

    // 5. Midtrans
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Build parameters for Midtrans
    let snapToken = null;
    try {
        if (snap) {
            const parameter = {
                transaction_details: {
                    order_id: transaction.midtransOrderId,
                    gross_amount: totalAmount
                },
                customer_details: {
                    first_name: user.nama.split(' ')[0],
                    email: user.email,
                    phone: address.noTelepon,
                    billing_address: {
                        first_name: address.namaPenerima,
                        phone: address.noTelepon,
                        address: address.alamatLengkap,
                        city: address.kota,
                        postal_code: address.kodePos,
                        country_code: 'IDN'
                    },
                    shipping_address: {
                        first_name: address.namaPenerima,
                        phone: address.noTelepon,
                        address: address.alamatLengkap,
                        city: address.kota,
                        postal_code: address.kodePos,
                        country_code: 'IDN'
                    }
                }
            };
            
            const snapResponse = await snap.createTransaction(parameter);
            snapToken = snapResponse.token;

            // Update Snap Token in DB
            await prisma.transaksi.update({
                where: { id: transaction.id },
                data: { snapToken }
            });

            transaction.snapToken = snapToken;
        }
    } catch (err) {
        console.error('Midtrans Snap Error:', err);
    }

    return transaction;
};

const checkoutDirect = async (userId, data) => {
    const { produkId, kuantitas, alamatId, metodePengiriman } = data;

    // 1. Fetch Product
    const product = await prisma.produkNutrishop.findUnique({
        where: { id: parseInt(produkId) }
    });

    if (!product || !product.isActive) {
        throw ApiError.notFound('Product not found');
    }

    if (product.stok < kuantitas) {
        throw ApiError.badRequest('Insufficient stock');
    }

    // 2. Validate Address
    const address = await prisma.alamatPengiriman.findFirst({
        where: { id: parseInt(alamatId), userId }
    });

    if (!address) {
        throw ApiError.notFound('Address not found or does not belong to user');
    }

    if (!SHIPPING_COSTS[metodePengiriman]) {
        throw ApiError.badRequest('Invalid metodePengiriman');
    }

    // 3. Calculate Totals
    const subtotal = product.harga * parseInt(kuantitas);
    const shippingCost = SHIPPING_COSTS[metodePengiriman];
    const totalAmount = subtotal + shippingCost;
    const orderId = `SHOP-${Date.now()}-${userId}`;

    // 4. Create Transaction
    const transaction = await prisma.$transaction(async (tx) => {
        const t = await tx.transaksi.create({
            data: {
                userId,
                midtransOrderId: orderId,
                jenisTransaksi: 'SHOP',
                totalHarga: totalAmount,
                statusBayar: 'PENDING',
                alamatId: parseInt(alamatId),
                metodePengiriman,
                biayaPengiriman: shippingCost,
                detailTransaksi: {
                    create: [{
                        produkId: product.id,
                        kuantitas: parseInt(kuantitas),
                        hargaSatuan: product.harga,
                        subtotal
                    }]
                }
            }
        });

        // Update Stock
        await tx.produkNutrishop.update({
            where: { id: product.id },
            data: { stok: { decrement: parseInt(kuantitas) } }
        });

        return t;
    });

    // 5. Midtrans
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    let snapToken = null;
    try {
        if (snap) {
            const parameter = {
                transaction_details: {
                    order_id: transaction.midtransOrderId,
                    gross_amount: totalAmount
                },
                customer_details: {
                    first_name: user.nama.split(' ')[0],
                    email: user.email,
                    phone: address.noTelepon,
                    billing_address: {
                        first_name: address.namaPenerima,
                        phone: address.noTelepon,
                        address: address.alamatLengkap,
                        city: address.kota,
                        postal_code: address.kodePos,
                        country_code: 'IDN'
                    },
                    shipping_address: {
                        first_name: address.namaPenerima,
                        phone: address.noTelepon,
                        address: address.alamatLengkap,
                        city: address.kota,
                        postal_code: address.kodePos,
                        country_code: 'IDN'
                    }
                }
            };
            
            const snapResponse = await snap.createTransaction(parameter);
            snapToken = snapResponse.token;

            await prisma.transaksi.update({
                where: { id: transaction.id },
                data: { snapToken }
            });

            transaction.snapToken = snapToken;
        }
    } catch (err) {
        console.error('Midtrans Snap Error:', err);
    }

    return transaction;
};

module.exports = {
    getProducts,
    getProductById,
    addProduct,
    getCart,
    addToCart,
    addAddress,
    getAddresses,
    checkoutCart,
    checkoutDirect
};
