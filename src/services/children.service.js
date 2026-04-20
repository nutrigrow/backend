const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const aiService = require("./ai.service");

// ============================================
// PERCENTILE HELPERS
// ============================================

const HEIGHT_PERCENTILE_COLS = [
  "p01_height",
  "p1_height",
  "p3_height",
  "p5_height",
  "p10_height",
  "p15_height",
  "p25_height",
  "p50_height",
  "p75_height",
  "p85_height",
  "p90_height",
  "p95_height",
  "p97_height",
  "p99_height",
  "p999_height",
];

const WEIGHT_PERCENTILE_COLS = [
  "p01_weight",
  "p1_weight",
  "p3_weight",
  "p5_weight",
  "p10_weight",
  "p15_weight",
  "p25_weight",
  "p50_weight",
  "p75_weight",
  "p85_weight",
  "p90_weight",
  "p95_weight",
  "p97_weight",
  "p99_weight",
  "p999_weight",
];

const PERCENTILE_LABELS = [
  "P0.1",
  "P1",
  "P3",
  "P5",
  "P10",
  "P15",
  "P25",
  "P50",
  "P75",
  "P85",
  "P90",
  "P95",
  "P97",
  "P99",
  "P99.9",
];

/**
 * Find which percentile bracket a measurement falls into.
 * Returns the label of the highest bracket whose reference value <= measurement,
 * or a boundary string if below/above all brackets.
 */
const findPercentileBracket = (value, whoRow, cols) => {
  if (!whoRow) return null;

  // Walk from highest to lowest to find the highest bracket the value meets/exceeds
  for (let i = cols.length - 1; i >= 0; i--) {
    const ref = whoRow[cols[i]];
    if (ref !== null && ref !== undefined && value >= ref) {
      if (i === cols.length - 1) return `> ${PERCENTILE_LABELS[i]}`;
      return `${PERCENTILE_LABELS[i]}`;
    }
  }
  return `< ${PERCENTILE_LABELS[0]}`;
};

/**
 * Calculate age in whole days between two dates.
 */
const calcAgeDays = (birthDate, measureDate) => {
  const birth = new Date(birthDate);
  const measure = new Date(measureDate);
  const diffMs = measure.getTime() - birth.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

// ============================================
// OWNERSHIP HELPER
// ============================================

const assertOwnership = async (balitaId, userId) => {
  const balita = await prisma.balita.findUnique({ where: { id: balitaId } });
  if (!balita) throw ApiError.notFound("Data anak tidak ditemukan");
  if (balita.userId !== userId)
    throw ApiError.forbidden("Akses tidak diizinkan");
  return balita;
};

// ============================================
// A. CHILD PROFILE MANAGEMENT
// ============================================

const getAllChildren = async (userId) => {
  return prisma.balita.findMany({
    where: { userId },
    select: {
      id: true,
      namaDepan: true,
      namaAkhir: true,
      tanggalLahir: true,
      jenisKelamin: true,
    },
    orderBy: { createdAt: "asc" },
  });
};

const createChild = async (userId, body) => {
  const { namaDepan, namaAkhir, tanggalLahir, jenisKelamin } = body;
  return prisma.balita.create({
    data: {
      userId,
      namaDepan,
      namaAkhir: namaAkhir || null,
      tanggalLahir: new Date(tanggalLahir),
      jenisKelamin,
    },
    select: {
      id: true,
      namaDepan: true,
      namaAkhir: true,
      tanggalLahir: true,
      jenisKelamin: true,
    },
  });
};

const getChildById = async (balitaId, userId) => {
  const balita = await prisma.balita.findUnique({
    where: { id: balitaId },
    select: {
      id: true,
      userId: true,
      namaDepan: true,
      namaAkhir: true,
      tanggalLahir: true,
      jenisKelamin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!balita || balita.userId !== userId) {
    throw ApiError.notFound("Data anak tidak ditemukan");
  }

  const { userId: _uid, ...result } = balita;
  return result;
};
const updateChild = async (balitaId, userId, body) => {
  await assertOwnership(balitaId, userId);
  const { namaDepan, namaAkhir, tanggalLahir, jenisKelamin } = body;
  return prisma.balita.update({
    where: { id: balitaId },
    data: {
      namaDepan,
      namaAkhir: namaAkhir || null,
      tanggalLahir: new Date(tanggalLahir),
      jenisKelamin,
    },
    select: {
      id: true,
      namaDepan: true,
      namaAkhir: true,
      tanggalLahir: true,
      jenisKelamin: true,
    },
  });
};

// ============================================
// B. GROWTH TRACKER INPUT
// ============================================

const getChildName = async (balitaId, userId) => {
  await assertOwnership(balitaId, userId);
  return prisma.balita.findUnique({
    where: { id: balitaId },
    select: { namaDepan: true, namaAkhir: true },
  });
};

const createGrowthRecord = async (balitaId, userId, body) => {
  const balita = await assertOwnership(balitaId, userId);
  const { tinggiBadan, beratBadan, tanggalCatat } = body;

  const tb = parseFloat(tinggiBadan);
  const bb = parseFloat(beratBadan);
  const date = new Date(tanggalCatat);

  // 1. Calculate age for AI
  const ageDays = calcAgeDays(balita.tanggalLahir, date);
  const ageMonths = ageDays / 30.44;

  // 2. Fetch User Profile for Mother's Height
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tinggiBadanIbu: true }
  });

  // 2. Run AI Prediction (Async but we want to store it)
  let risikoStuntingMl = null;
  let mlConfidence = null;

  try {
    const prediction = await aiService.predictStunting({
      umurBulan: ageMonths,
      jenisKelamin: balita.jenisKelamin,
      tinggiBadan: tb,
      beratBadan: bb,
      tinggiBadanIbu: user?.tinggiBadanIbu,
    });
    risikoStuntingMl = prediction.prediction_label;
    mlConfidence = prediction.confidence * 100;
  } catch (error) {
    console.error("AI Prediction failed:", error);
  }

  return prisma.rekamPertumbuhan.create({
    data: {
      balitaId,
      tinggiBadan: tb,
      beratBadan: bb,
      tanggalCatat: date,
      risikoStuntingMl,
      mlConfidence,
    },
  });
};

const updateGrowthRecord = async (recordId, userId, body) => {
  const record = await prisma.rekamPertumbuhan.findUnique({
    where: { id: recordId },
    include: { 
      balita: {
        include: { user: { select: { tinggiBadanIbu: true } } }
      } 
    },
  });

  if (!record || record.balita.userId !== userId) {
    throw ApiError.notFound("Data pertumbuhan tidak ditemukan");
  }

  const { tinggiBadan, beratBadan, tanggalCatat } = body;
  const tb = parseFloat(tinggiBadan);
  const bb = parseFloat(beratBadan);
  const date = new Date(tanggalCatat);

  // Recalculate AI Prediction for the updated data
  let risikoStuntingMl = record.risikoStuntingMl;
  let mlConfidence = record.mlConfidence;

  try {
    const ageDays = calcAgeDays(record.balita.tanggalLahir, date);
    const prediction = await aiService.predictStunting({
      umurBulan: ageDays / 30.44,
      jenisKelamin: record.balita.jenisKelamin,
      tinggiBadan: tb,
      beratBadan: bb,
      tinggiBadanIbu: record.balita.user?.tinggiBadanIbu,
    });
    risikoStuntingMl = prediction.prediction_label;
    mlConfidence = prediction.confidence * 100;
  } catch (error) {
    console.error("AI Prediction failed during update:", error);
  }

  return prisma.rekamPertumbuhan.update({
    where: { id: recordId },
    data: {
      tinggiBadan: tb,
      beratBadan: bb,
      tanggalCatat: date,
      risikoStuntingMl,
      mlConfidence,
    },
  });
};

const deleteGrowthRecord = async (recordId, userId) => {
  const record = await prisma.rekamPertumbuhan.findUnique({
    where: { id: recordId },
    include: { balita: true },
  });

  if (!record || record.balita.userId !== userId) {
    throw ApiError.notFound("Data pertumbuhan tidak ditemukan");
  }

  return prisma.rekamPertumbuhan.delete({
    where: { id: recordId },
  });
};

// ============================================
// C. GROWTH TRACKER DASHBOARD — LATEST
// ============================================

const getLatestGrowth = async (balitaId, userId) => {
  await assertOwnership(balitaId, userId);

  const latest = await prisma.rekamPertumbuhan.findFirst({
    where: { balitaId },
    orderBy: { tanggalCatat: "desc" },
    select: {
      tinggiBadan: true,
      beratBadan: true,
      tanggalCatat: true,
    },
  });

  if (!latest) {
    return {
      message: "Belum ada data pertumbuhan anak. Silakan input data pertama!",
      data: null,
    };
  }

  return { message: "Berhasil", data: latest };
};

// ============================================
// D. BMI CHART VS WHO
// ============================================

const getBmiChart = async (balitaId, userId) => {
  const balita = await assertOwnership(balitaId, userId);

  const histories = await prisma.rekamPertumbuhan.findMany({
    where: { balitaId },
    orderBy: { tanggalCatat: "asc" },
    select: { id: true, tinggiBadan: true, beratBadan: true, tanggalCatat: true },
  });

  if (!histories.length) return [];

  // Calculate per-record BMI
  const childData = histories.map((rec) => {
    const usiaHari = calcAgeDays(balita.tanggalLahir, rec.tanggalCatat);
    const bmiAnak = rec.beratBadan / Math.pow(rec.tinggiBadan / 100, 2);
    return {
      usiaHari,
      bmiAnak: parseFloat(bmiAnak.toFixed(2)),
      tanggalCatat: rec.tanggalCatat,
    };
  });

  const maxUsiaHari = Math.max(...childData.map((d) => d.usiaHari));

  // Fetch WHO BMI standards up to max age
  const whoField = balita.jenisKelamin === "LAKI_LAKI" ? "bmi_boy" : "bmi_girl";
  const whoData = await prisma.bmi.findMany({
    where: { day: { lte: maxUsiaHari } },
    select: { day: true, [whoField]: true },
    orderBy: { day: "asc" },
  });

  // Build a lookup map: day -> WHO BMI value
  const whoMap = {};
  whoData.forEach((row) => {
    whoMap[row.day] = row[whoField];
  });

  return childData.map(({ usiaHari, bmiAnak, tanggalCatat }) => ({
    tanggalCatat,
    usiaHari,
    bmiAnak,
    bmiStandarWho: whoMap[usiaHari] ?? null,
  }));
};

// ============================================
// E. GROWTH TRACKER PERCENTILE
// ============================================

const getPercentile = async (balitaId, userId) => {
  const balita = await assertOwnership(balitaId, userId);

  const histories = await prisma.rekamPertumbuhan.findMany({
    where: { balitaId },
    orderBy: { tanggalCatat: "desc" },
    select: {
      id: true,
      tinggiBadan: true,
      beratBadan: true,
      tanggalCatat: true,
      risikoStuntingMl: true,
      mlConfidence: true,
    },
  });

  if (!histories.length) return [];

  const isLaki = balita.jenisKelamin === "LAKI_LAKI";

  const result = await Promise.all(
    histories.map(async (rec) => {
      const usiaHari = calcAgeDays(balita.tanggalLahir, rec.tanggalCatat);

      let whoRow;
      if (isLaki) {
        whoRow = await prisma.pertumbuhanLakiLaki.findUnique({
          where: { day: usiaHari },
        });
      } else {
        whoRow = await prisma.pertumbuhanPerempuan.findUnique({
          where: { day: usiaHari },
        });
      }

      const persentilTinggi = findPercentileBracket(
        rec.tinggiBadan,
        whoRow,
        HEIGHT_PERCENTILE_COLS,
      );
      const persentilBerat = findPercentileBracket(
        rec.beratBadan,
        whoRow,
        WEIGHT_PERCENTILE_COLS,
      );

      return {
        id: rec.id,
        tanggalCatat: rec.tanggalCatat,
        usiaHari,
        tinggiBadan: rec.tinggiBadan,
        beratBadan: rec.beratBadan,
        persentilTinggi,
        persentilBerat,
        risikoStuntingMl: rec.risikoStuntingMl,
        mlConfidence: rec.mlConfidence,
      };
    }),
  );

  return result;
};

module.exports = {
  getAllChildren,
  createChild,
  getChildById,
  updateChild,
  getChildName,
  createGrowthRecord,
  updateGrowthRecord,
  deleteGrowthRecord,
  getLatestGrowth,
  getBmiChart,
  getPercentile,
};
