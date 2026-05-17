const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const nutrishopRoutes = require("./nutrishop.routes");
const childrenRoutes = require("./children.routes");
const healthLogRoutes = require("./healthLog.routes");
const specialistRoutes = require("./specialist.routes");
const consultationRoutes = require("./consultation.routes");
const articleRoutes = require("./article.routes");
const adminRoutes = require("./admin.routes");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);
router.use("/health-logs", healthLogRoutes);
router.use("/specialists", specialistRoutes);
router.use("/consultations", consultationRoutes);
router.use("/articles", articleRoutes);
router.use("/admin", adminRoutes);
router.use("/", nutrishopRoutes);

// Health check for API
router.get("/hello", (req, res) => {
  res.json({
    status: "success",
    message: "Hello from NutriGrow API!",
  });
});

module.exports = router;
