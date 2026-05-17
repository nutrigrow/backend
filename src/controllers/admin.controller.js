const catchAsync = require("../utils/catchAsync");
const { success, created } = require("../utils/responseHelper");
const adminService = require("../services/admin.service");

const getDashboard = catchAsync(async (_req, res) => {
  const dashboard = await adminService.getDashboard();

  success(res, {
    message: "Dashboard admin berhasil diambil",
    data: dashboard,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const result = await adminService.getUsers(req.query);

  success(res, {
    message: "Data pengguna berhasil diambil",
    data: result,
  });
});

const setUserActive = catchAsync(async (req, res) => {
  const user = await adminService.setUserActive(req.params.id, req.body);

  success(res, {
    message: "Status pengguna berhasil diperbarui",
    data: { user },
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const user = await adminService.deleteUser(req.params.id);

  success(res, {
    message: "Pengguna berhasil dihapus",
    data: { user },
  });
});

const getProducts = catchAsync(async (req, res) => {
  const result = await adminService.getProducts(req.query);

  success(res, {
    message: "Data produk berhasil diambil",
    data: result,
  });
});

const createProduct = catchAsync(async (req, res) => {
  const product = await adminService.createProduct(req.body, req.file);

  created(res, {
    message: "Produk berhasil dibuat",
    data: { product },
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const product = await adminService.updateProduct(req.params.id, req.body, req.file);

  success(res, {
    message: "Produk berhasil diperbarui",
    data: { product },
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const product = await adminService.deleteProduct(req.params.id);

  success(res, {
    message: "Produk berhasil dinonaktifkan",
    data: { product },
  });
});

const getNutritionists = catchAsync(async (req, res) => {
  const result = await adminService.getNutritionists(req.query);

  success(res, {
    message: "Data ahli gizi berhasil diambil",
    data: result,
  });
});

const createNutritionist = catchAsync(async (req, res) => {
  const nutritionist = await adminService.createNutritionist(req.body);

  created(res, {
    message: "Ahli gizi berhasil dibuat",
    data: { nutritionist },
  });
});

const updateNutritionist = catchAsync(async (req, res) => {
  const nutritionist = await adminService.updateNutritionist(req.params.id, req.body);

  success(res, {
    message: "Ahli gizi berhasil diperbarui",
    data: { nutritionist },
  });
});

const deleteNutritionist = catchAsync(async (req, res) => {
  const nutritionist = await adminService.deleteNutritionist(req.params.id);

  success(res, {
    message: "Ahli gizi berhasil dihapus",
    data: { nutritionist },
  });
});

const getArticles = catchAsync(async (req, res) => {
  const result = await adminService.getArticles(req.query);

  success(res, {
    message: "Data artikel berhasil diambil",
    data: result,
  });
});

const createArticle = catchAsync(async (req, res) => {
  const article = await adminService.createArticle(req.body, req.file);

  created(res, {
    message: "Artikel berhasil dibuat",
    data: { article },
  });
});

const updateArticle = catchAsync(async (req, res) => {
  const article = await adminService.updateArticle(req.params.id, req.body, req.file);

  success(res, {
    message: "Artikel berhasil diperbarui",
    data: { article },
  });
});

const deleteArticle = catchAsync(async (req, res) => {
  const article = await adminService.deleteArticle(req.params.id);

  success(res, {
    message: "Artikel berhasil dihapus",
    data: { article },
  });
});

const getShopOrders = catchAsync(async (req, res) => {
  const result = await adminService.getShopOrders(req.query);

  success(res, {
    message: "Data transaksi NutriShop berhasil diambil",
    data: result,
  });
});

const updateShopOrderStatus = catchAsync(async (req, res) => {
  const order = await adminService.updateShopOrderStatus(req.params.id, req.body);

  success(res, {
    message: "Status transaksi NutriShop berhasil diperbarui",
    data: { order },
  });
});

const getConsultations = catchAsync(async (req, res) => {
  const result = await adminService.getConsultations(req.query);

  success(res, {
    message: "Data konsultasi berhasil diambil",
    data: result,
  });
});

const updateConsultation = catchAsync(async (req, res) => {
  const consultation = await adminService.updateConsultation(req.params.id, req.body);

  success(res, {
    message: "Konsultasi berhasil diperbarui",
    data: { consultation },
  });
});

module.exports = {
  getDashboard,
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
};
