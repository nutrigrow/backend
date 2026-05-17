const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const upload = require("../middlewares/upload.middleware");
const {
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
} = require("../validators/admin.validator");

router.use(authenticate, authorize("ADMIN"));

router.get("/dashboard", adminController.getDashboard);

router.get("/users", validate(userListSchema), adminController.getUsers);
router.patch(
  "/users/:id/active",
  validate(setUserActiveSchema),
  adminController.setUserActive,
);
router.delete("/users/:id", validate(idParamSchema), adminController.deleteUser);

router.get("/products", validate(productListSchema), adminController.getProducts);
router.post(
  "/products",
  upload.single("gambar"),
  validate(createProductSchema),
  adminController.createProduct,
);
router.patch(
  "/products/:id",
  upload.single("gambar"),
  validate(updateProductSchema),
  adminController.updateProduct,
);
router.delete("/products/:id", validate(idParamSchema), adminController.deleteProduct);

router.get(
  "/nutritionists",
  validate(nutritionistListSchema),
  adminController.getNutritionists,
);
router.post(
  "/nutritionists",
  validate(createNutritionistSchema),
  adminController.createNutritionist,
);
router.patch(
  "/nutritionists/:id",
  validate(updateNutritionistSchema),
  adminController.updateNutritionist,
);
router.delete(
  "/nutritionists/:id",
  validate(idParamSchema),
  adminController.deleteNutritionist,
);

router.get("/articles", validate(articleListSchema), adminController.getArticles);
router.post(
  "/articles",
  upload.single("gambar"),
  validate(createArticleSchema),
  adminController.createArticle,
);
router.patch(
  "/articles/:id",
  upload.single("gambar"),
  validate(updateArticleSchema),
  adminController.updateArticle,
);
router.delete("/articles/:id", validate(idParamSchema), adminController.deleteArticle);

router.get(
  "/orders/shop",
  validate(shopOrderListSchema),
  adminController.getShopOrders,
);
router.patch(
  "/orders/shop/:id/status",
  validate(updateShopOrderStatusSchema),
  adminController.updateShopOrderStatus,
);

router.get(
  "/consultations",
  validate(consultationListSchema),
  adminController.getConsultations,
);
router.patch(
  "/consultations/:id",
  validate(updateConsultationSchema),
  adminController.updateConsultation,
);

module.exports = router;
