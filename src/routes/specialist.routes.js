const express = require("express");
const router = express.Router();
const specialistController = require("../controllers/specialist.controller");

router.get("/", specialistController.getSpecialists);
router.get("/:id", specialistController.getSpecialistById);

module.exports = router;
