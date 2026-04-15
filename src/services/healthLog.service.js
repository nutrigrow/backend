const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");

// ============================================
// CONSTANTS & MAPPINGS
// ============================================

const PROFILE_TYPE_MAP = {
  teen: "REMAJA",
  pregnant: "HAMIL",
  breastfeeding: "MENYUSUI",
};

const FASE_TO_PROFILE_TYPE_MAP = {
  REMAJA: "teen",
  HAMIL: "pregnant",
  MENYUSUI: "breastfeeding",
};

const HYDRATION_TARGETS = {
  REMAJA: 8,
  HAMIL: 10,
  MENYUSUI: 12,
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ============================================
// HELPERS
// ============================================

/**
 * Parse a YYYY-MM-DD string and return a Date at midnight UTC.
 */
const parseDateUTC = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/**
 * Return today's date at midnight UTC.
 */
const todayUTC = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

/**
 * Map a raw Prisma LogKesehatan record to the English-field API response shape.
 */
const formatLog = (log) => {
  if (!log) return null;

  const formatted = {
    id: log.id,
    user_id: log.userId,
    date:
      log.tanggalCatat instanceof Date
        ? log.tanggalCatat.toISOString().slice(0, 10)
        : log.tanggalCatat,
    day: log.day,
    profile_type: FASE_TO_PROFILE_TYPE_MAP[log.fase] ?? log.fase,
    water_glasses: log.jumlahGelasAir,
    sleep_hours: log.durasiTidur,
    took_supplement: log.minumSuplemen,
    mood: log.mood,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
  };

  // Conditional fields — only include when present in the record
  if (log.sedangHaid !== null && log.sedangHaid !== undefined) {
    formatted.is_menstruating = log.sedangHaid;
  }
  if (log.beratBadanKg !== null && log.beratBadanKg !== undefined) {
    formatted.weight_kg = log.beratBadanKg;
  }
  if (log.frekuensiMenyusui !== null && log.frekuensiMenyusui !== undefined) {
    formatted.breastfeeding_count = log.frekuensiMenyusui;
  }

  return formatted;
};

/**
 * Map API body fields (English) to Prisma field names (Indonesian).
 */
const mapBodyToPrisma = (body) => {
  const fase = PROFILE_TYPE_MAP[body.profile_type];
  const dateUTC = parseDateUTC(body.date);
  const day = DAY_NAMES[dateUTC.getUTCDay()];

  const data = {
    fase,
    day,
    jumlahGelasAir: body.water_glasses,
    durasiTidur: body.sleep_hours,
    minumSuplemen: body.took_supplement,
    mood: body.mood,
  };

  // Conditional fields
  if (body.is_menstruating !== undefined)
    data.sedangHaid = body.is_menstruating;
  if (body.weight_kg !== undefined) data.beratBadanKg = body.weight_kg;
  if (body.breastfeeding_count !== undefined)
    data.frekuensiMenyusui = body.breastfeeding_count;

  return { data, dateUTC };
};

/**
 * Fetch the two most recent rekam_pertumbuhan records across all balita
 * belonging to a user, sorted descending by tanggalCatat.
 */
const getLatestTwoGrowthRecords = async (userId) => {
  const records = await prisma.rekamPertumbuhan.findMany({
    where: {
      balita: { userId },
    },
    orderBy: { tanggalCatat: "desc" },
    take: 2,
    select: {
      tanggalCatat: true,
      tinggiBadan: true,
      beratBadan: true,
      balitaId: true,
    },
  });
  return records;
};

/**
 * Build the baby_growth insight object, or null if insufficient data.
 */
const buildBabyGrowthInsight = (records) => {
  if (!records || records.length === 0) return null;

  const latest = records[0];

  if (records.length === 1) {
    return {
      current_height: latest.tinggiBadan,
      previous_height: null,
      growth_cm: null,
      is_growing: null,
    };
  }

  const previous = records[1];
  const growthCm = parseFloat(
    (latest.tinggiBadan - previous.tinggiBadan).toFixed(2),
  );

  return {
    current_height: latest.tinggiBadan,
    previous_height: previous.tinggiBadan,
    growth_cm: growthCm,
    is_growing: growthCm > 0,
  };
};

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Upsert a health log for the given user.
 * Uses the @@unique([userId, tanggalCatat]) constraint.
 */
const createOrUpdateLog = async (userId, body) => {
  const { data, dateUTC } = mapBodyToPrisma(body);

  // Cek apakah sudah ada log di tanggal ini dengan fase berbeda
  const existing = await prisma.logKesehatan.findUnique({
    where: {
      userId_tanggalCatat: {
        userId,
        tanggalCatat: dateUTC,
      },
    },
    select: { fase: true },
  });

  if (existing && existing.fase !== data.fase) {
    const existingProfileType = FASE_TO_PROFILE_TYPE_MAP[existing.fase];
    throw ApiError.conflict(
      `Log tanggal ini sudah diisi dengan profile_type "${existingProfileType}". Tidak bisa diubah ke profile_type yang berbeda dalam satu hari.`,
    );
  }

  const log = await prisma.logKesehatan.upsert({
    where: {
      userId_tanggalCatat: {
        userId,
        tanggalCatat: dateUTC,
      },
    },
    update: data,
    create: {
      userId,
      tanggalCatat: dateUTC,
      ...data,
    },
  });

  return formatLog(log);
};

/**
 * Get today's health log for the given user, or null if none exists.
 */
const getTodayLog = async (userId) => {
  const today = todayUTC();

  const log = await prisma.logKesehatan.findUnique({
    where: {
      userId_tanggalCatat: {
        userId,
        tanggalCatat: today,
      },
    },
  });

  return log ? formatLog(log) : null;
};

/**
 * Get all health logs for the given user, newest first.
 */
const getAllLogs = async (userId) => {
  const logs = await prisma.logKesehatan.findMany({
    where: { userId },
    orderBy: { tanggalCatat: "desc" },
  });

  return logs.map(formatLog);
};

/**
 * Get insight data for the given user based on today's log and baby growth.
 */
const getInsight = async (userId) => {
  const today = todayUTC();

  const [log, growthRecords] = await Promise.all([
    prisma.logKesehatan.findUnique({
      where: {
        userId_tanggalCatat: {
          userId,
          tanggalCatat: today,
        },
      },
    }),
    getLatestTwoGrowthRecords(userId),
  ]);

  const babyGrowth = buildBabyGrowthInsight(growthRecords);

  if (!log) {
    return {
      has_log_today: false,
      ...(babyGrowth && { baby_growth: babyGrowth }),
    };
  }

  const hydrationTarget = HYDRATION_TARGETS[log.fase] ?? 8;
  const hydrationPercent = Math.min(
    Math.round((log.jumlahGelasAir / hydrationTarget) * 100),
    100,
  );
  const sleepPercent = Math.min(Math.round((log.durasiTidur / 8) * 100), 100);

  const insight = {
    has_log_today: true,
    date: today.toISOString().slice(0, 10),
    day: log.day,
    profile_type: FASE_TO_PROFILE_TYPE_MAP[log.fase] ?? log.fase,
    hydration_percent: hydrationPercent,
    water_glasses: log.jumlahGelasAir,
    hydration_target: hydrationTarget,
    sleep_percent: sleepPercent,
    sleep_hours: log.durasiTidur,
    supplement_taken: log.minumSuplemen,
    mood: log.mood,
  };

  if (babyGrowth) {
    insight.baby_growth = babyGrowth;
  }

  return insight;
};

/**
 * Get notification items for the given user.
 */
const getNotifications = async (userId) => {
  const today = todayUTC();

  // Tomorrow at midnight UTC
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);

  // 28 days ago
  const twentyEightDaysAgo = new Date(today);
  twentyEightDaysAgo.setUTCDate(twentyEightDaysAgo.getUTCDate() - 28);

  const [log, nextConsultation, allBalita] = await Promise.all([
    prisma.logKesehatan.findUnique({
      where: {
        userId_tanggalCatat: {
          userId,
          tanggalCatat: today,
        },
      },
    }),
    prisma.konsultasi.findFirst({
      where: {
        userId,
        status: { in: ["BOOKED", "CONFIRMED"] },
        jadwalSesi: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
      },
    }),
    prisma.balita.findMany({
      where: { userId },
      select: { id: true },
    }),
  ]);

  const notifications = [];

  // ── 1. Daily check-in ──────────────────────────────────────────────────────
  const isLogComplete = (() => {
    if (!log) return false;
    const baseComplete =
      log.jumlahGelasAir !== null &&
      log.durasiTidur !== null &&
      log.minumSuplemen !== null &&
      log.mood !== null;

    if (!baseComplete) return false;

    if (log.fase === "REMAJA" && log.sedangHaid === null) return false;
    if (log.fase === "HAMIL" && log.beratBadanKg === null) return false;
    if (log.fase === "MENYUSUI" && log.frekuensiMenyusui === null) return false;

    return true;
  })();

  if (!isLogComplete) {
    notifications.push({
      type: "daily_check",
      message: "Data log hari ini belum lengkap. Yuk, catat kesehatanmu!",
    });
  }

  // ── 2. Supplement reminders (only when log exists) ────────────────────────
  if (log && log.minumSuplemen === false) {
    if (log.fase === "REMAJA") {
      notifications.push({
        type: "supplement_teen",
        message:
          "Hari ini belum mencatat konsumsi Tablet Tambah Darah (TTD). Yuk, rutin minum agar tetap fit!",
      });
    } else if (log.fase === "HAMIL" || log.fase === "MENYUSUI") {
      notifications.push({
        type: "supplement_mom",
        message:
          "Bunda, jangan lupa suplemen nutrisi hari ini untuk kesehatan Bunda dan si Kecil.",
      });
    }
  }

  // ── 3. Menstruation reminder ───────────────────────────────────────────────
  if (log && log.fase === "REMAJA" && log.sedangHaid === true) {
    notifications.push({
      type: "menstruation",
      message:
        "Sedang masa haid? Pastikan hidrasi dan asupan zat besi terjaga hari ini ya.",
    });
  }

  // ── 4. ANC / consultation reminder ────────────────────────────────────────
  if (nextConsultation) {
    notifications.push({
      type: "anc_reminder",
      message:
        "Persiapan Kontrol: Besok adalah jadwal kunjungan ke dokter/bidan. Pastikan Bunda sudah siap!",
    });
  }

  // ── 5. Baby growth staleness ───────────────────────────────────────────────
  if (allBalita.length > 0) {
    const balitaIds = allBalita.map((b) => b.id);

    // Find the latest rekam_pertumbuhan for each balita
    const latestRecords = await Promise.all(
      balitaIds.map((balitaId) =>
        prisma.rekamPertumbuhan.findFirst({
          where: { balitaId },
          orderBy: { tanggalCatat: "desc" },
          select: { tanggalCatat: true },
        }),
      ),
    );

    // Trigger the notification if at least one balita is stale (or has no record)
    const hasStaleGrowth = latestRecords.some(
      (record) => record === null || record.tanggalCatat < twentyEightDaysAgo,
    );

    if (hasStaleGrowth) {
      notifications.push({
        type: "baby_growth",
        message:
          "Sudah hampir sebulan! Yuk, ukur pertumbuhan si Kecil hari ini agar terpantau optimal.",
      });
    }
  }

  return {
    has_notification: notifications.length > 0,
    notifications,
  };
};

module.exports = {
  createOrUpdateLog,
  getTodayLog,
  getAllLogs,
  getInsight,
  getNotifications,
};
