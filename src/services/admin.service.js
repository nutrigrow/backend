const bcrypt = require("bcryptjs");
const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const {
  compressAndSaveProductImage,
  compressAndSaveArticleImage,
} = require("../utils/imageCompressor");
const { BCRYPT_SALT_ROUNDS } = require("../utils/constants");

const STATUS_BAYAR_VALUES = new Set([
  "PENDING",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
  "REFUND",
]);

const STATUS_KONSULTASI_VALUES = new Set([
  "BOOKED",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);

const METODE_KONSULTASI_VALUES = new Set(["VIDEO_CALL", "CHAT"]);
const ROLE_VALUES = new Set(["USER", "AHLI_GIZI", "ADMIN"]);
const KATEGORI_PRODUK_VALUES = new Set(["MPASI", "SUPLEMEN", "ALAT", "PAKET"]);
const KATEGORI_ARTIKEL_VALUES = new Set([
  "STUNTING",
  "GIZI",
  "MPASI",
  "KEHAMILAN",
  "MENYUSUI",
]);

const SHOP_ORDER_INCLUDE = {
  user: {
    select: {
      id: true,
      nama: true,
      email: true,
      avatarUrl: true,
    },
  },
  alamat: true,
  detailTransaksi: {
    include: {
      produk: {
        select: {
          id: true,
          namaProduk: true,
          gambarUrl: true,
          harga: true,
          kategori: true,
        },
      },
    },
  },
};

const CONSULTATION_INCLUDE = {
  user: {
    select: {
      id: true,
      nama: true,
      email: true,
      avatarUrl: true,
    },
  },
  ahliGizi: {
    include: {
      user: {
        select: {
          id: true,
          nama: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  },
  transaksi: true,
};

const toPositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`${fieldName} harus berupa angka positif`);
  }
  return parsed;
};

const toNonNegativeInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw ApiError.badRequest(`${fieldName} harus berupa angka minimal 0`);
  }
  return parsed;
};

const toOptionalPositiveInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return undefined;
  return toPositiveInt(value, fieldName);
};

const toBoolean = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
};

const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildPagination = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

const getProductStatus = (stok) => {
  if (stok === 0) return "HABIS";
  if (stok <= 10) return "STOK_RENDAH";
  return "TERSEDIA";
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const serializeUser = (user) => ({
  id: user.id,
  nama: user.nama,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl,
  isActive: user.isActive,
  status: user.isActive ? "AKTIF" : "NONAKTIF",
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  deletedAt: user.deletedAt,
});

const serializeProduct = (product) => ({
  id: product.id,
  namaProduk: product.namaProduk,
  deskripsi: product.deskripsi,
  kategori: product.kategori,
  gambarUrl: product.gambarUrl,
  harga: product.harga,
  stok: product.stok,
  isActive: product.isActive,
  status: getProductStatus(product.stok),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const serializeNutritionist = (profile) => ({
  id: profile.id,
  userId: profile.userId,
  nama: profile.user?.nama || "",
  email: profile.user?.email || "",
  avatarUrl: profile.user?.avatarUrl || null,
  userIsActive: profile.user?.isActive ?? true,
  gelar: profile.gelar,
  sertifikasi: profile.sertifikasi,
  spesialisasi: profile.spesialisasi,
  pengalamanTahun: profile.pengalamanTahun,
  pendidikan: profile.pendidikan,
  registrasiMedis: profile.registrasiMedis,
  noTelepon: profile.noTelepon,
  bidangKeahlian: profile.bidangKeahlian,
  jadwal: profile.jadwal,
  biayaVideoCall: profile.biayaVideoCall,
  biayaChat: profile.biayaChat,
  fotoUrl: profile.fotoUrl,
  bio: profile.bio,
  isAvailable: profile.isAvailable,
  status: profile.isAvailable ? "TERSEDIA" : "TIDAK_TERSEDIA",
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

const serializeArticle = (article) => ({
  id: article.id,
  judul: article.judul,
  slug: article.slug,
  konten: article.konten,
  kategori: article.kategori,
  gambarUrl: article.gambarUrl,
  penulis: article.penulis,
  isPublished: article.isPublished,
  status: article.isPublished ? "PUBLISHED" : "DRAFT",
  publishedAt: article.publishedAt,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
});

const serializeShopOrder = (order) => ({
  id: order.id,
  midtransOrderId: order.midtransOrderId,
  midtransTransactionId: order.midtransTransactionId,
  jenisTransaksi: order.jenisTransaksi,
  statusBayar: order.statusBayar,
  totalHarga: order.totalHarga,
  biayaPengiriman: order.biayaPengiriman,
  metodePengiriman: order.metodePengiriman,
  snapToken: order.snapToken,
  paymentType: order.paymentType,
  tanggalTransaksi: order.tanggalTransaksi,
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  user: order.user,
  alamat: order.alamat,
  items: (order.detailTransaksi || []).map((item) => ({
    id: item.id,
    produkId: item.produkId,
    kuantitas: item.kuantitas,
    hargaSatuan: item.hargaSatuan,
    subtotal: item.subtotal,
    produk: item.produk,
  })),
});

const serializeConsultation = (consultation) => ({
  id: consultation.id,
  userId: consultation.userId,
  ahliGiziId: consultation.ahliGiziId,
  transaksiId: consultation.transaksiId,
  jadwalSesi: consultation.jadwalSesi,
  durasiMenit: consultation.durasiMenit,
  metode: consultation.metode,
  status: consultation.status,
  catatanKonsultasi: consultation.catatanKonsultasi,
  linkMeeting: consultation.linkMeeting,
  createdAt: consultation.createdAt,
  updatedAt: consultation.updatedAt,
  user: consultation.user,
  ahliGizi: consultation.ahliGizi
    ? {
        id: consultation.ahliGizi.id,
        userId: consultation.ahliGizi.userId,
        nama: consultation.ahliGizi.user?.nama || "",
        email: consultation.ahliGizi.user?.email || "",
        avatarUrl: consultation.ahliGizi.user?.avatarUrl || null,
        spesialisasi: consultation.ahliGizi.spesialisasi,
        gelar: consultation.ahliGizi.gelar,
        fotoUrl: consultation.ahliGizi.fotoUrl,
      }
    : null,
  transaksi: consultation.transaksi,
});

const assertAnotherActiveAdminExists = async (adminId) => {
  const count = await prisma.user.count({
    where: {
      id: { not: adminId },
      role: "ADMIN",
      isActive: true,
      deletedAt: null,
    },
  });

  if (count === 0) {
    throw ApiError.badRequest("Admin terakhir tidak boleh dinonaktifkan atau dihapus");
  }
};

const ensureUniqueArticleSlug = async (baseSlug, excludeId) => {
  const cleanedBase = slugify(baseSlug) || "artikel";
  let candidate = cleanedBase;
  let suffix = 2;

  while (true) {
    const existing = await prisma.artikelEdukasi.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
    candidate = `${cleanedBase}-${suffix}`;
    suffix += 1;
  }
};

const getUsers = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.includeDeleted !== "true") {
    where.deletedAt = null;
  }

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (query.role) {
    const role = String(query.role).toUpperCase();
    if (!ROLE_VALUES.has(role)) throw ApiError.badRequest("Role tidak valid");
    where.role = role;
  }

  const isActive = toBoolean(query.isActive);
  if (isActive !== undefined) where.isActive = isActive;

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {};
    if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
    if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
  }

  const sortMap = {
    "nama-az": { nama: "asc" },
    "nama-za": { nama: "desc" },
    "bergabung-terbaru": { createdAt: "desc" },
    "bergabung-terlama": { createdAt: "asc" },
  };

  const orderBy = sortMap[query.sort] || { createdAt: "desc" };

  const [total, users, stats] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    getUserStats(),
  ]);

  return {
    users: users.map(serializeUser),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getUserStats = async () => {
  const [total, active, inactive, admins] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    prisma.user.count({ where: { deletedAt: null, isActive: false } }),
    prisma.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
  ]);

  return { total, active, inactive, admins };
};

const setUserActive = async (id, body = {}) => {
  const userId = toPositiveInt(id, "id");
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) throw ApiError.notFound("User tidak ditemukan");

  const nextActive =
    body.isActive === undefined ? !user.isActive : Boolean(body.isActive);

  if (user.role === "ADMIN" && !nextActive) {
    await assertAnotherActiveAdminExists(user.id);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: nextActive },
  });

  return serializeUser(updated);
};

const deleteUser = async (id) => {
  const userId = toPositiveInt(id, "id");
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) throw ApiError.notFound("User tidak ditemukan");

  if (user.role === "ADMIN") {
    await assertAnotherActiveAdminExists(user.id);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  return serializeUser(updated);
};

const getProducts = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.includeInactive !== "true") {
    where.isActive = true;
  }

  if (query.search) {
    where.namaProduk = {
      contains: String(query.search).trim(),
      mode: "insensitive",
    };
  }

  if (query.kategori) {
    const kategori = String(query.kategori).toUpperCase();
    if (!KATEGORI_PRODUK_VALUES.has(kategori)) {
      throw ApiError.badRequest("Kategori produk tidak valid");
    }
    where.kategori = kategori;
  }

  const minStock = toOptionalPositiveInt(query.minStock, "minStock");
  const maxStock = toOptionalPositiveInt(query.maxStock, "maxStock");
  if (minStock !== undefined || maxStock !== undefined) {
    where.stok = {};
    if (minStock !== undefined) where.stok.gte = minStock;
    if (maxStock !== undefined) where.stok.lte = maxStock;
  }

  const minPrice = toOptionalPositiveInt(query.minPrice, "minPrice");
  const maxPrice = toOptionalPositiveInt(query.maxPrice, "maxPrice");
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.harga = {};
    if (minPrice !== undefined) where.harga.gte = minPrice;
    if (maxPrice !== undefined) where.harga.lte = maxPrice;
  }

  const sortMap = {
    "nama-az": { namaProduk: "asc" },
    "harga-terendah": { harga: "asc" },
    "harga-tertinggi": { harga: "desc" },
    "stok-terendah": { stok: "asc" },
  };
  const orderBy = sortMap[query.sort] || { updatedAt: "desc" };

  const [total, products, stats] = await Promise.all([
    prisma.produkNutrishop.count({ where }),
    prisma.produkNutrishop.findMany({ where, orderBy, skip, take: limit }),
    getProductStats(),
  ]);

  return {
    products: products.map(serializeProduct),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getProductStats = async () => {
  const [total, available, lowStock, outOfStock, inactive] = await Promise.all([
    prisma.produkNutrishop.count({ where: { isActive: true } }),
    prisma.produkNutrishop.count({
      where: { isActive: true, stok: { gt: 10 } },
    }),
    prisma.produkNutrishop.count({
      where: { isActive: true, stok: { gt: 0, lte: 10 } },
    }),
    prisma.produkNutrishop.count({ where: { isActive: true, stok: 0 } }),
    prisma.produkNutrishop.count({ where: { isActive: false } }),
  ]);

  return { total, available, lowStock, outOfStock, inactive };
};

const buildProductData = async (body, file, existing = {}) => {
  const data = {};

  if (body.namaProduk !== undefined) data.namaProduk = body.namaProduk;
  if (body.deskripsi !== undefined) data.deskripsi = body.deskripsi || null;
  if (body.kategori !== undefined) {
    const kategori = String(body.kategori).toUpperCase();
    if (!KATEGORI_PRODUK_VALUES.has(kategori)) {
      throw ApiError.badRequest("Kategori produk tidak valid");
    }
    data.kategori = kategori;
  }
  if (body.harga !== undefined) data.harga = toPositiveInt(body.harga, "harga");
  if (body.stok !== undefined) data.stok = toNonNegativeInt(body.stok, "stok");

  const isActive = toBoolean(body.isActive);
  if (isActive !== undefined) data.isActive = isActive;

  if (file) {
    const prefix = data.namaProduk || existing.namaProduk || "product";
    data.gambarUrl = await compressAndSaveProductImage(file.buffer, prefix);
  } else if (body.gambarUrl !== undefined) {
    data.gambarUrl = body.gambarUrl || null;
  }

  return data;
};

const createProduct = async (body, file) => {
  const data = await buildProductData(body, file);

  for (const field of ["namaProduk", "kategori", "harga"]) {
    if (data[field] === undefined) {
      throw ApiError.badRequest(`${field} harus diisi`);
    }
  }

  if (data.stok === undefined) data.stok = 0;

  const product = await prisma.produkNutrishop.create({ data });
  return serializeProduct(product);
};

const updateProduct = async (id, body, file) => {
  const productId = toPositiveInt(id, "id");
  const existing = await prisma.produkNutrishop.findUnique({
    where: { id: productId },
  });

  if (!existing) throw ApiError.notFound("Produk tidak ditemukan");

  const data = await buildProductData(body, file, existing);
  const updated = await prisma.produkNutrishop.update({
    where: { id: productId },
    data,
  });

  return serializeProduct(updated);
};

const deleteProduct = async (id) => {
  const productId = toPositiveInt(id, "id");
  const existing = await prisma.produkNutrishop.findUnique({
    where: { id: productId },
  });

  if (!existing) throw ApiError.notFound("Produk tidak ditemukan");

  const updated = await prisma.produkNutrishop.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return serializeProduct(updated);
};

const getNutritionists = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = {
    user: { is: { deletedAt: null } },
  };

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { user: { is: { nama: { contains: search, mode: "insensitive" } } } },
      { user: { is: { email: { contains: search, mode: "insensitive" } } } },
      { spesialisasi: { contains: search, mode: "insensitive" } },
      { registrasiMedis: { contains: search, mode: "insensitive" } },
    ];
  }

  if (query.spesialisasi) {
    where.spesialisasi = {
      contains: String(query.spesialisasi),
      mode: "insensitive",
    };
  }

  const isAvailable = toBoolean(query.isAvailable);
  if (isAvailable !== undefined) where.isAvailable = isAvailable;

  const minExp = toOptionalPositiveInt(query.minExperience, "minExperience");
  const maxExp = toOptionalPositiveInt(query.maxExperience, "maxExperience");
  if (minExp !== undefined || maxExp !== undefined) {
    where.pengalamanTahun = {};
    if (minExp !== undefined) where.pengalamanTahun.gte = minExp;
    if (maxExp !== undefined) where.pengalamanTahun.lte = maxExp;
  }

  const sortMap = {
    "nama-az": { user: { nama: "asc" } },
    "pengalaman-terbanyak": { pengalamanTahun: "desc" },
    "pengalaman-tersedikit": { pengalamanTahun: "asc" },
  };
  const orderBy = sortMap[query.sort] || { updatedAt: "desc" };

  const [total, nutritionists, stats] = await Promise.all([
    prisma.profilAhliGizi.count({ where }),
    prisma.profilAhliGizi.findMany({
      where,
      include: { user: true },
      orderBy,
      skip,
      take: limit,
    }),
    getNutritionistStats(),
  ]);

  return {
    nutritionists: nutritionists.map(serializeNutritionist),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getNutritionistStats = async () => {
  const [total, available, aggregate, specialties] = await Promise.all([
    prisma.profilAhliGizi.count({ where: { user: { is: { deletedAt: null } } } }),
    prisma.profilAhliGizi.count({
      where: { isAvailable: true, user: { is: { deletedAt: null } } },
    }),
    prisma.profilAhliGizi.aggregate({
      where: { user: { is: { deletedAt: null } } },
      _avg: { pengalamanTahun: true },
    }),
    prisma.profilAhliGizi.findMany({
      where: { user: { is: { deletedAt: null } }, spesialisasi: { not: null } },
      distinct: ["spesialisasi"],
      select: { spesialisasi: true },
    }),
  ]);

  return {
    total,
    available,
    unavailable: total - available,
    avgExperience: Math.round(aggregate._avg.pengalamanTahun || 0),
    specializations: specialties.length,
  };
};

const buildNutritionistProfileData = (body = {}) => {
  const data = {};

  if (body.gelar !== undefined) data.gelar = body.gelar || null;
  if (body.sertifikasi !== undefined) data.sertifikasi = body.sertifikasi;
  if (body.spesialisasi !== undefined) data.spesialisasi = body.spesialisasi || null;
  if (body.pengalamanTahun !== undefined) {
    data.pengalamanTahun = toNonNegativeInt(
      body.pengalamanTahun,
      "pengalamanTahun",
    );
  }
  if (body.pendidikan !== undefined) data.pendidikan = body.pendidikan || null;
  if (body.registrasiMedis !== undefined) {
    data.registrasiMedis = body.registrasiMedis || null;
  }
  if (body.noTelepon !== undefined) data.noTelepon = body.noTelepon || null;
  if (body.bidangKeahlian !== undefined) {
    data.bidangKeahlian = body.bidangKeahlian || null;
  }
  if (body.jadwal !== undefined) data.jadwal = body.jadwal || null;
  if (body.biayaVideoCall !== undefined) {
    data.biayaVideoCall = toNonNegativeInt(body.biayaVideoCall, "biayaVideoCall");
  }
  if (body.biayaChat !== undefined) {
    data.biayaChat = toNonNegativeInt(body.biayaChat, "biayaChat");
  }
  if (body.fotoUrl !== undefined) data.fotoUrl = body.fotoUrl || null;
  if (body.bio !== undefined) data.bio = body.bio || null;

  const isAvailable = toBoolean(body.isAvailable);
  if (isAvailable !== undefined) data.isAvailable = isAvailable;

  return data;
};

const createNutritionist = async (body = {}) => {
  if (!body.nama || !body.email) {
    throw ApiError.badRequest("nama dan email harus diisi");
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw ApiError.conflict("Email sudah terdaftar");

  const profileData = buildNutritionistProfileData(body);
  if (!profileData.sertifikasi) {
    profileData.sertifikasi =
      body.registrasiMedis || body.strNumber || "Belum diisi";
  }

  const passwordHash = body.password
    ? await bcrypt.hash(body.password, BCRYPT_SALT_ROUNDS)
    : null;

  const created = await prisma.user.create({
    data: {
      nama: body.nama,
      email: body.email,
      passwordHash,
      role: "AHLI_GIZI",
      isActive: toBoolean(body.isActive) ?? true,
      emailVerifiedAt: new Date(),
      profilAhliGizi: {
        create: profileData,
      },
    },
    include: { profilAhliGizi: { include: { user: true } } },
  });

  return serializeNutritionist(created.profilAhliGizi);
};

const updateNutritionist = async (id, body = {}) => {
  const profileId = toPositiveInt(id, "id");
  const existing = await prisma.profilAhliGizi.findUnique({
    where: { id: profileId },
    include: { user: true },
  });

  if (!existing || existing.user.deletedAt) {
    throw ApiError.notFound("Ahli gizi tidak ditemukan");
  }

  const userData = {};
  if (body.nama !== undefined) userData.nama = body.nama;
  if (body.email !== undefined && body.email !== existing.user.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: body.email } });
    if (duplicate) throw ApiError.conflict("Email sudah terdaftar");
    userData.email = body.email;
  }
  if (body.avatarUrl !== undefined) userData.avatarUrl = body.avatarUrl || null;
  const userIsActive = toBoolean(body.isActive);
  if (userIsActive !== undefined) userData.isActive = userIsActive;

  const profileData = buildNutritionistProfileData(body);

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: existing.userId }, data: userData });
    }

    return tx.profilAhliGizi.update({
      where: { id: profileId },
      data: profileData,
      include: { user: true },
    });
  });

  return serializeNutritionist(updated);
};

const deleteNutritionist = async (id) => {
  const profileId = toPositiveInt(id, "id");
  const existing = await prisma.profilAhliGizi.findUnique({
    where: { id: profileId },
    include: { user: true },
  });

  if (!existing || existing.user.deletedAt) {
    throw ApiError.notFound("Ahli gizi tidak ditemukan");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { isActive: false, deletedAt: new Date() },
    });

    return tx.profilAhliGizi.update({
      where: { id: profileId },
      data: { isAvailable: false },
      include: { user: true },
    });
  });

  return serializeNutritionist(updated);
};

const getArticles = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { judul: { contains: search, mode: "insensitive" } },
      { penulis: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (query.kategori) {
    const kategori = String(query.kategori).toUpperCase();
    if (!KATEGORI_ARTIKEL_VALUES.has(kategori)) {
      throw ApiError.badRequest("Kategori artikel tidak valid");
    }
    where.kategori = kategori;
  }

  if (query.status) {
    const status = String(query.status).toUpperCase();
    if (!["PUBLISHED", "DRAFT"].includes(status)) {
      throw ApiError.badRequest("Status artikel tidak valid");
    }
    where.isPublished = status === "PUBLISHED";
  }

  const sortMap = {
    terbaru: { publishedAt: "desc" },
    terlama: { publishedAt: "asc" },
    "judul-az": { judul: "asc" },
  };
  const orderBy = sortMap[query.sort] || { updatedAt: "desc" };

  const [total, articles, stats] = await Promise.all([
    prisma.artikelEdukasi.count({ where }),
    prisma.artikelEdukasi.findMany({ where, orderBy, skip, take: limit }),
    getArticleStats(),
  ]);

  return {
    articles: articles.map(serializeArticle),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getArticleStats = async () => {
  const [total, published, draft] = await Promise.all([
    prisma.artikelEdukasi.count(),
    prisma.artikelEdukasi.count({ where: { isPublished: true } }),
    prisma.artikelEdukasi.count({ where: { isPublished: false } }),
  ]);

  return { total, published, draft };
};

const buildArticleData = async (body = {}, file, existing = {}) => {
  const data = {};

  if (body.judul !== undefined) data.judul = body.judul;
  if (body.konten !== undefined) data.konten = body.konten;
  if (body.content !== undefined) data.konten = body.content;
  if (body.kategori !== undefined) {
    const kategori = String(body.kategori).toUpperCase();
    if (!KATEGORI_ARTIKEL_VALUES.has(kategori)) {
      throw ApiError.badRequest("Kategori artikel tidak valid");
    }
    data.kategori = kategori;
  }
  if (body.penulis !== undefined) data.penulis = body.penulis || null;

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!["PUBLISHED", "DRAFT"].includes(status)) {
      throw ApiError.badRequest("Status artikel tidak valid");
    }
    data.isPublished = status === "PUBLISHED";
    data.publishedAt =
      status === "PUBLISHED"
        ? body.publishedAt
          ? new Date(body.publishedAt)
          : existing.publishedAt || new Date()
        : null;
  }

  if (body.isPublished !== undefined && body.status === undefined) {
    const isPublished = toBoolean(body.isPublished);
    if (isPublished !== undefined) {
      data.isPublished = isPublished;
      data.publishedAt = isPublished
        ? body.publishedAt
          ? new Date(body.publishedAt)
          : existing.publishedAt || new Date()
        : null;
    }
  }

  const slugSource = body.slug || data.judul;
  if (slugSource !== undefined) {
    data.slug = await ensureUniqueArticleSlug(slugSource, existing.id);
  }

  if (file) {
    const prefix = data.slug || existing.slug || data.judul || existing.judul || "article";
    data.gambarUrl = await compressAndSaveArticleImage(file.buffer, prefix);
  } else if (body.gambarUrl !== undefined) {
    data.gambarUrl = body.gambarUrl || null;
  }

  return data;
};

const createArticle = async (body, file) => {
  const data = await buildArticleData(body, file);

  for (const field of ["judul", "konten", "kategori"]) {
    if (data[field] === undefined) {
      throw ApiError.badRequest(`${field} harus diisi`);
    }
  }

  if (data.isPublished === undefined) {
    data.isPublished = false;
    data.publishedAt = null;
  }

  if (!data.slug) data.slug = await ensureUniqueArticleSlug(data.judul);

  const article = await prisma.artikelEdukasi.create({ data });
  return serializeArticle(article);
};

const updateArticle = async (id, body, file) => {
  const articleId = toPositiveInt(id, "id");
  const existing = await prisma.artikelEdukasi.findUnique({
    where: { id: articleId },
  });

  if (!existing) throw ApiError.notFound("Artikel tidak ditemukan");

  const data = await buildArticleData(body, file, existing);
  const updated = await prisma.artikelEdukasi.update({
    where: { id: articleId },
    data,
  });

  return serializeArticle(updated);
};

const deleteArticle = async (id) => {
  const articleId = toPositiveInt(id, "id");
  const existing = await prisma.artikelEdukasi.findUnique({
    where: { id: articleId },
  });

  if (!existing) throw ApiError.notFound("Artikel tidak ditemukan");

  const deleted = await prisma.artikelEdukasi.delete({
    where: { id: articleId },
  });

  return serializeArticle(deleted);
};

const getShopOrders = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = { jenisTransaksi: "SHOP" };

  if (query.statusBayar) {
    const statusBayar = String(query.statusBayar).toUpperCase();
    if (!STATUS_BAYAR_VALUES.has(statusBayar)) {
      throw ApiError.badRequest("Status bayar tidak valid");
    }
    where.statusBayar = statusBayar;
  }

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { midtransOrderId: { contains: search, mode: "insensitive" } },
      { user: { is: { nama: { contains: search, mode: "insensitive" } } } },
      { user: { is: { email: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.tanggalTransaksi = {};
    if (query.dateFrom) where.tanggalTransaksi.gte = new Date(query.dateFrom);
    if (query.dateTo) where.tanggalTransaksi.lte = new Date(query.dateTo);
  }

  const orderBy = query.sort === "total"
    ? { totalHarga: query.order === "asc" ? "asc" : "desc" }
    : { tanggalTransaksi: query.order === "asc" ? "asc" : "desc" };

  const [total, orders, stats] = await Promise.all([
    prisma.transaksi.count({ where }),
    prisma.transaksi.findMany({
      where,
      include: SHOP_ORDER_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    getShopOrderStats(),
  ]);

  return {
    orders: orders.map(serializeShopOrder),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getShopOrderStats = async () => {
  const [total, pending, success, failed, revenue] = await Promise.all([
    prisma.transaksi.count({ where: { jenisTransaksi: "SHOP" } }),
    prisma.transaksi.count({
      where: { jenisTransaksi: "SHOP", statusBayar: "PENDING" },
    }),
    prisma.transaksi.count({
      where: { jenisTransaksi: "SHOP", statusBayar: "SUCCESS" },
    }),
    prisma.transaksi.count({
      where: { jenisTransaksi: "SHOP", statusBayar: { in: ["FAILED", "EXPIRED", "REFUND"] } },
    }),
    prisma.transaksi.aggregate({
      where: { jenisTransaksi: "SHOP", statusBayar: "SUCCESS" },
      _sum: { totalHarga: true },
    }),
  ]);

  return {
    total,
    pending,
    success,
    failed,
    revenue: revenue._sum.totalHarga || 0,
  };
};

const updateShopOrderStatus = async (id, body = {}) => {
  const orderId = toPositiveInt(id, "id");
  const nextStatus = String(body.statusBayar || body.status || "").toUpperCase();

  if (!STATUS_BAYAR_VALUES.has(nextStatus)) {
    throw ApiError.badRequest("Status bayar tidak valid");
  }

  const existing = await prisma.transaksi.findFirst({
    where: { id: orderId, jenisTransaksi: "SHOP" },
    include: SHOP_ORDER_INCLUDE,
  });

  if (!existing) throw ApiError.notFound("Transaksi tidak ditemukan");

  const shouldRestoreStock =
    existing.statusBayar === "PENDING" &&
    ["FAILED", "EXPIRED", "REFUND"].includes(nextStatus);

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldRestoreStock) {
      for (const item of existing.detailTransaksi) {
        await tx.produkNutrishop.update({
          where: { id: item.produkId },
          data: { stok: { increment: item.kuantitas } },
        });
      }
    }

    return tx.transaksi.update({
      where: { id: orderId },
      data: {
        statusBayar: nextStatus,
        paidAt: nextStatus === "SUCCESS" ? existing.paidAt || new Date() : existing.paidAt,
      },
      include: SHOP_ORDER_INCLUDE,
    });
  });

  return serializeShopOrder(updated);
};

const getConsultations = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.status) {
    const status = String(query.status).toUpperCase();
    if (!STATUS_KONSULTASI_VALUES.has(status)) {
      throw ApiError.badRequest("Status konsultasi tidak valid");
    }
    where.status = status;
  }

  if (query.metode) {
    const metode = String(query.metode).toUpperCase();
    if (!METODE_KONSULTASI_VALUES.has(metode)) {
      throw ApiError.badRequest("Metode konsultasi tidak valid");
    }
    where.metode = metode;
  }

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { user: { is: { nama: { contains: search, mode: "insensitive" } } } },
      { user: { is: { email: { contains: search, mode: "insensitive" } } } },
      {
        ahliGizi: {
          is: {
            user: { is: { nama: { contains: search, mode: "insensitive" } } },
          },
        },
      },
      {
        transaksi: {
          is: { midtransOrderId: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.jadwalSesi = {};
    if (query.dateFrom) where.jadwalSesi.gte = new Date(query.dateFrom);
    if (query.dateTo) where.jadwalSesi.lte = new Date(query.dateTo);
  }

  const orderBy = { jadwalSesi: query.order === "asc" ? "asc" : "desc" };

  const [total, consultations, stats] = await Promise.all([
    prisma.konsultasi.count({ where }),
    prisma.konsultasi.findMany({
      where,
      include: CONSULTATION_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    getConsultationStats(),
  ]);

  return {
    consultations: consultations.map(serializeConsultation),
    stats,
    pagination: buildPagination(total, page, limit),
  };
};

const getConsultationStats = async () => {
  const [total, booked, confirmed, inProgress, done, cancelled, revenue] =
    await Promise.all([
      prisma.konsultasi.count(),
      prisma.konsultasi.count({ where: { status: "BOOKED" } }),
      prisma.konsultasi.count({ where: { status: "CONFIRMED" } }),
      prisma.konsultasi.count({ where: { status: "IN_PROGRESS" } }),
      prisma.konsultasi.count({ where: { status: "DONE" } }),
      prisma.konsultasi.count({ where: { status: "CANCELLED" } }),
      prisma.transaksi.aggregate({
        where: {
          jenisTransaksi: "TELE_NUTRITIONIST",
          statusBayar: "SUCCESS",
        },
        _sum: { totalHarga: true },
      }),
    ]);

  return {
    total,
    booked,
    confirmed,
    inProgress,
    done,
    cancelled,
    revenue: revenue._sum.totalHarga || 0,
  };
};

const updateConsultation = async (id, body = {}) => {
  const consultationId = toPositiveInt(id, "id");
  const existing = await prisma.konsultasi.findUnique({
    where: { id: consultationId },
  });

  if (!existing) throw ApiError.notFound("Konsultasi tidak ditemukan");

  const data = {};

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!STATUS_KONSULTASI_VALUES.has(status)) {
      throw ApiError.badRequest("Status konsultasi tidak valid");
    }
    data.status = status;
  }

  if (body.metode !== undefined) {
    const metode = String(body.metode).toUpperCase();
    if (!METODE_KONSULTASI_VALUES.has(metode)) {
      throw ApiError.badRequest("Metode konsultasi tidak valid");
    }
    data.metode = metode;
  }

  if (body.jadwalSesi !== undefined) {
    const nextSchedule = new Date(body.jadwalSesi);
    if (Number.isNaN(nextSchedule.getTime())) {
      throw ApiError.badRequest("jadwalSesi tidak valid");
    }

    const conflict = await prisma.konsultasi.findFirst({
      where: {
        id: { not: consultationId },
        ahliGiziId: existing.ahliGiziId,
        jadwalSesi: nextSchedule,
        status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });

    if (conflict) {
      throw ApiError.badRequest("Jadwal sudah terisi");
    }

    data.jadwalSesi = nextSchedule;
  }

  if (body.catatanKonsultasi !== undefined) {
    data.catatanKonsultasi = body.catatanKonsultasi || null;
  }

  if (body.linkMeeting !== undefined) {
    data.linkMeeting = body.linkMeeting || null;
  }

  const updated = await prisma.konsultasi.update({
    where: { id: consultationId },
    data,
    include: CONSULTATION_INCLUDE,
  });

  return serializeConsultation(updated);
};

const getDashboard = async () => {
  const [
    userStats,
    productStats,
    nutritionistStats,
    articleStats,
    shopStats,
    consultationStats,
    recentUsers,
    recentProducts,
    recentShopOrders,
    recentConsultations,
    recentArticles,
  ] = await Promise.all([
    getUserStats(),
    getProductStats(),
    getNutritionistStats(),
    getArticleStats(),
    getShopOrderStats(),
    getConsultationStats(),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, nama: true, createdAt: true },
    }),
    prisma.produkNutrishop.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, namaProduk: true, updatedAt: true },
    }),
    prisma.transaksi.findMany({
      where: { jenisTransaksi: "SHOP" },
      orderBy: { tanggalTransaksi: "desc" },
      take: 5,
      select: { id: true, midtransOrderId: true, tanggalTransaksi: true },
    }),
    prisma.konsultasi.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { nama: true } },
        ahliGizi: { include: { user: { select: { nama: true } } } },
      },
    }),
    prisma.artikelEdukasi.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, judul: true, updatedAt: true, isPublished: true },
    }),
  ]);

  const activities = [
    ...recentUsers.map((user) => ({
      type: "user",
      message: "Pengguna baru terdaftar",
      sub: `${user.nama} telah bergabung`,
      at: user.createdAt,
      refId: user.id,
    })),
    ...recentProducts.map((product) => ({
      type: "product",
      message: "Produk diperbarui",
      sub: product.namaProduk,
      at: product.updatedAt,
      refId: product.id,
    })),
    ...recentShopOrders.map((order) => ({
      type: "order",
      message: "Transaksi NutriShop",
      sub: order.midtransOrderId,
      at: order.tanggalTransaksi,
      refId: order.id,
    })),
    ...recentConsultations.map((consultation) => ({
      type: "session",
      message: "Sesi konsultasi",
      sub: `${consultation.user?.nama || "Pengguna"} dengan ${
        consultation.ahliGizi?.user?.nama || "Ahli gizi"
      }`,
      at: consultation.createdAt,
      refId: consultation.id,
    })),
    ...recentArticles.map((article) => ({
      type: "article",
      message: article.isPublished ? "Artikel diterbitkan" : "Artikel draft diperbarui",
      sub: article.judul,
      at: article.updatedAt,
      refId: article.id,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  return {
    stats: {
      users: userStats,
      products: productStats,
      nutritionists: nutritionistStats,
      articles: articleStats,
      shopOrders: shopStats,
      consultations: consultationStats,
      revenue: {
        shop: shopStats.revenue,
        teleNutritionist: consultationStats.revenue,
        total: shopStats.revenue + consultationStats.revenue,
      },
    },
    activities,
  };
};

module.exports = {
  getUsers,
  setUserActive,
  deleteUser,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getNutritionists,
  createNutritionist,
  updateNutritionist,
  deleteNutritionist,
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  getShopOrders,
  updateShopOrderStatus,
  getConsultations,
  updateConsultation,
  getDashboard,
};
