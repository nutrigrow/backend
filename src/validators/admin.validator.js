const { z } = require("zod");

const idParamSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID harus berupa angka"),
  }),
};

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

const optionalNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return Number(value);
}, z.number().optional());

const paginationQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const userListSchema = {
  query: paginationQuery.extend({
    role: z.enum(["USER", "AHLI_GIZI", "ADMIN"]).optional(),
    isActive: z.string().optional(),
    includeDeleted: z.string().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
  }),
};

const setUserActiveSchema = {
  params: idParamSchema.params,
  body: z.object({
    isActive: optionalBoolean,
  }),
};

const productListSchema = {
  query: paginationQuery.extend({
    kategori: z.enum(["MPASI", "SUPLEMEN", "ALAT", "PAKET"]).optional(),
    includeInactive: z.string().optional(),
    minStock: z.string().optional(),
    maxStock: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
  }),
};

const createProductSchema = {
  body: z.object({
    namaProduk: z.string().min(1, "Nama produk harus diisi").trim(),
    deskripsi: z.string().optional(),
    kategori: z.enum(["MPASI", "SUPLEMEN", "ALAT", "PAKET"]),
    harga: optionalNumber,
    stok: optionalNumber,
    gambarUrl: z.string().optional(),
    isActive: optionalBoolean,
  }),
};

const updateProductSchema = {
  params: idParamSchema.params,
  body: createProductSchema.body.partial(),
};

const nutritionistListSchema = {
  query: paginationQuery.extend({
    spesialisasi: z.string().optional(),
    isAvailable: z.string().optional(),
    minExperience: z.string().optional(),
    maxExperience: z.string().optional(),
  }),
};

const createNutritionistSchema = {
  body: z.object({
    nama: z.string().min(1, "Nama harus diisi").trim(),
    email: z.string().email("Format email tidak valid").toLowerCase().trim(),
    password: z.string().min(8).optional(),
    avatarUrl: z.string().optional(),
    gelar: z.string().optional(),
    sertifikasi: z.string().optional(),
    spesialisasi: z.string().optional(),
    pengalamanTahun: optionalNumber,
    pendidikan: z.any().optional(),
    registrasiMedis: z.string().optional(),
    strNumber: z.string().optional(),
    noTelepon: z.string().optional(),
    bidangKeahlian: z.any().optional(),
    jadwal: z.any().optional(),
    biayaVideoCall: optionalNumber,
    biayaChat: optionalNumber,
    fotoUrl: z.string().optional(),
    bio: z.string().optional(),
    isAvailable: optionalBoolean,
    isActive: optionalBoolean,
  }),
};

const updateNutritionistSchema = {
  params: idParamSchema.params,
  body: createNutritionistSchema.body.partial(),
};

const articleListSchema = {
  query: paginationQuery.extend({
    kategori: z
      .enum(["STUNTING", "GIZI", "MPASI", "KEHAMILAN", "MENYUSUI"])
      .optional(),
    status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
  }),
};

const createArticleSchema = {
  body: z.object({
    judul: z.string().min(1, "Judul harus diisi").trim(),
    slug: z.string().optional(),
    konten: z.string().optional(),
    content: z.string().optional(),
    kategori: z.enum(["STUNTING", "GIZI", "MPASI", "KEHAMILAN", "MENYUSUI"]),
    gambarUrl: z.string().optional(),
    penulis: z.string().optional(),
    status: z.enum(["PUBLISHED", "DRAFT"]).optional(),
    isPublished: optionalBoolean,
    publishedAt: z.string().optional(),
  }),
};

const updateArticleSchema = {
  params: idParamSchema.params,
  body: createArticleSchema.body.partial(),
};

const shopOrderListSchema = {
  query: paginationQuery.extend({
    statusBayar: z
      .enum(["PENDING", "SUCCESS", "FAILED", "EXPIRED", "REFUND"])
      .optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
};

const updateShopOrderStatusSchema = {
  params: idParamSchema.params,
  body: z.object({
    statusBayar: z.enum(["PENDING", "SUCCESS", "FAILED", "EXPIRED", "REFUND"]).optional(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "EXPIRED", "REFUND"]).optional(),
  }),
};

const consultationListSchema = {
  query: paginationQuery.extend({
    status: z
      .enum(["BOOKED", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELLED"])
      .optional(),
    metode: z.enum(["VIDEO_CALL", "CHAT"]).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
};

const updateConsultationSchema = {
  params: idParamSchema.params,
  body: z.object({
    status: z
      .enum(["BOOKED", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELLED"])
      .optional(),
    metode: z.enum(["VIDEO_CALL", "CHAT"]).optional(),
    jadwalSesi: z.string().optional(),
    catatanKonsultasi: z.string().optional(),
    linkMeeting: z.string().optional(),
  }),
};

module.exports = {
  idParamSchema,
  userListSchema,
  setUserActiveSchema,
  productListSchema,
  createProductSchema,
  updateProductSchema,
  nutritionistListSchema,
  createNutritionistSchema,
  updateNutritionistSchema,
  articleListSchema,
  createArticleSchema,
  updateArticleSchema,
  shopOrderListSchema,
  updateShopOrderStatusSchema,
  consultationListSchema,
  updateConsultationSchema,
};
