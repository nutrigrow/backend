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

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Upsert a health log for the given user.
 * Uses the @@unique([userId, tanggalCatat]) constraint.
 */
const createOrUpdateLog = async (userId, body) => {
  const { data, dateUTC } = mapBodyToPrisma(body);
  if (dateUTC > todayUTC()) {
    throw ApiError.badRequest("Tanggal catatan kesehatan tidak boleh di masa depan");
  }

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
  if (existing) {
    if (existing.fase !== data.fase) {
      const existingProfileType = FASE_TO_PROFILE_TYPE_MAP[existing.fase];
      throw ApiError.conflict(
        `Log tanggal ini sudah diisi dengan profile_type "${existingProfileType}". Tidak bisa diubah ke profile_type yang berbeda dalam satu hari.`,
      );
    }
    if (!body.is_edit) {
      throw ApiError.badRequest("Anda sudah memasukkan entry untuk hari ini.");
    }
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
 * Delete one health log that belongs to the given user.
 * Filter userId memastikan pengguna hanya dapat menghapus catatannya sendiri.
 */
const deleteLog = async (userId, logId) => {
  const result = await prisma.logKesehatan.deleteMany({
    where: { id: logId, userId },
  });
  if (result.count === 0) {
    const message = "Catatan kesehatan tidak ditemukan";
    throw typeof ApiError.notFound === "function"
      ? ApiError.notFound(message)
      : ApiError.badRequest(message);
  }
  return { id: logId };
};

// ============================================
// CONTEXTUAL HEALTH INSIGHT
// ============================================
const INSIGHT_WINDOW_DAYS = 7;
const PREVIOUS_WINDOW_DAYS = 7;
const WEIGHT_WINDOW_DAYS = 14;
const MIN_LOGS_FOR_INSIGHT = 3;
const GOOD_LOGGING_MIN_DAYS = 5;
const MOOD_LOW_MAX = 2;
const MOOD_LOW_MIN_DAYS = 3;
const MOOD_LOW_URGENT_DAYS = 5;
const LOW_SLEEP_HOURS = 6;
const LOW_WATER_GLASSES = 6;
const MIN_SUPPLEMENT_DAYS = 4;
const LOW_BREASTFEEDING_SESSIONS = 6;
const OPTIMAL_BREASTFEEDING_SESSIONS = 8;
const WEIGHT_LOW_KG = 45;
const WEIGHT_HIGH_KG = 110;
const MAX_WEIGHT_CHANGE_RATIO = 0.15;
const MAX_VALID_SLEEP_HOURS = 24;
const MAX_VALID_WATER_GLASSES = 20;
const MAX_INSIGHTS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DISCLAIMER_BASE =
  "Informasi berdasarkan catatan pengguna dan bukan diagnosis medis.";
const DISCLAIMER_CONSULT = `${DISCLAIMER_BASE} Pertimbangkan konsultasi dengan tenaga kesehatan.`;

const INSIGHT_CATEGORY_PRIORITY = [
  "Segera Konsultasi",
  "Perlu Diperhatikan",
  "Cek Data",
  "Pengingat",
  "Perkembangan Baik",
];

const INSIGHT_CATEGORY_STATUS = {
  "Segera Konsultasi": "danger",
  "Perlu Diperhatikan": "caution",
  "Cek Data": "info",
  Pengingat: "info",
  "Perkembangan Baik": "safe",
};

const INSIGHT_ACTIONS = {
  consult: { type: "consult", label: "Konsultasi via Tele-Nutrition" },
  log: { type: "log", label: "Catat" },
  history: { type: "history", label: "Lihat Riwayat" },
  check: { type: "history", label: "Periksa Catatan" },
  article: { type: "article", label: "Baca Artikel" },
};

const DAY_LABELS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_LABELS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const MOOD_LABELS_ID = { 1: "Sedih", 2: "Lelah", 3: "Biasa", 4: "Nyaman", 5: "Bahagia" };

const daysBetween = (dateStr, today) =>
  Math.round((today.getTime() - parseDateUTC(dateStr).getTime()) / MS_PER_DAY);

const average = (values) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const formatNumber = (value) => String(Math.round(value * 10) / 10).replace(".", ",");

const isNum = (value) => typeof value === "number" && Number.isFinite(value);

const buildWindowDates = (today, days) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * MS_PER_DAY);
    return d.toISOString().slice(0, 10);
  });

const formatDayLabel = (dateStr) => {
  const d = parseDateUTC(dateStr);
  return `${DAY_LABELS_ID[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_LABELS_ID[d.getUTCMonth()]}`;
};

const buildHistory = (windowDates, byDate, describe) =>
  windowDates.map((date) => {
    const log = byDate.get(date);
    if (!log) {
      return { date, label: formatDayLabel(date), value: "Tidak ada catatan", state: "missing" };
    }
    const { value, flagged } = describe(log);
    return { date, label: formatDayLabel(date), value, state: flagged ? "flag" : "ok" };
  });

const periodLabel = (days) => `${days} hari terakhir`;

const joinNames = (names) =>
  names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`;

const trendText = (label, current, previous, previousCount, unit) => {
  if (previousCount < MIN_LOGS_FOR_INSIGHT) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) {
    return `${label} relatif sama dengan ${PREVIOUS_WINDOW_DAYS} hari sebelumnya (${formatNumber(previous)} ${unit})`;
  }
  return `${label} ${diff > 0 ? "naik" : "turun"} ${formatNumber(Math.abs(diff))} ${unit} dibanding ${PREVIOUS_WINDOW_DAYS} hari sebelumnya (${formatNumber(previous)} ${unit})`;
};

const buildInsight = ({
  id,
  fields,
  category,
  title,
  message,
  basedOn,
  action,
  patternSummary,
  dataUsed,
  history,
  reason,
  actionText,
}) => {
  const disclaimer =
    action === "consult" || category === "Segera Konsultasi"
      ? DISCLAIMER_CONSULT
      : DISCLAIMER_BASE;
  return {
    id,
    fields,
    category,
    status: INSIGHT_CATEGORY_STATUS[category],
    title,
    message,
    based_on: basedOn,
    action: INSIGHT_ACTIONS[action],
    disclaimer,
    detail: {
      title,
      pattern_summary: patternSummary,
      period: dataUsed.period,
      data_used: dataUsed.items,
      history,
      reason,
      action_text: actionText,
      disclaimer,
    },
  };
};

const findInvalidDataReasons = (windowLogs, weightLogs) => {
  const reasons = [];
  const flaggedDates = new Set();
  const flag = (predicate, reason) => {
    const hits = windowLogs.filter(predicate);
    if (hits.length > 0) {
      reasons.push(reason);
      hits.forEach((log) => flaggedDates.add(log.date));
    }
  };

  flag(
    (log) => !isNum(log.sleep_hours) || log.sleep_hours < 0 || log.sleep_hours > MAX_VALID_SLEEP_HOURS,
    "Durasi tidur di luar rentang wajar",
  );
  flag(
    (log) => !isNum(log.water_glasses) || log.water_glasses < 0 || log.water_glasses > MAX_VALID_WATER_GLASSES,
    "Asupan cairan di luar rentang wajar",
  );
  flag(
    (log) => !Number.isInteger(log.mood) || log.mood < 1 || log.mood > 5,
    "Nilai suasana hati tidak dikenali",
  );
  flag(
    (log) => log.breastfeeding_count !== undefined && (!isNum(log.breastfeeding_count) || log.breastfeeding_count < 0),
    "Jumlah sesi menyusui tidak valid",
  );

  const weights = weightLogs
    .filter((log) => log.weight_kg !== undefined && log.weight_kg !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weights.some((log) => !isNum(log.weight_kg) || log.weight_kg <= 0)) {
    reasons.push("Berat badan tidak valid");
    weights
      .filter((log) => !isNum(log.weight_kg) || log.weight_kg <= 0)
      .forEach((log) => flaggedDates.add(log.date));
  } else if (weights.length >= 2) {
    const first = weights[0].weight_kg;
    const last = weights[weights.length - 1].weight_kg;
    if (Math.abs(last - first) / first > MAX_WEIGHT_CHANGE_RATIO) {
      reasons.push(`Perubahan berat badan lebih dari 15% dalam ${WEIGHT_WINDOW_DAYS} hari`);
      flaggedDates.add(weights[0].date);
      flaggedDates.add(weights[weights.length - 1].date);
    }
  }

  return { reasons, flaggedDates };
};

const buildContext = (profile, windowLogs, previousLogs, weightLogs, today) => {
  const windowDates = buildWindowDates(today, INSIGHT_WINDOW_DAYS);
  const byDate = new Map(windowLogs.map((log) => [log.date, log]));
  return {
    profile,
    today,
    windowLogs,
    previousLogs,
    weightLogs,
    windowDates,
    byDate,
    total: windowLogs.length,
    period: periodLabel(INSIGHT_WINDOW_DAYS),
  };
};

const sleepStats = (ctx) => {
  const values = ctx.windowLogs.map((log) => log.sleep_hours);
  const avg = average(values);
  return {
    avg,
    lowDays: ctx.windowLogs.filter((log) => log.sleep_hours < LOW_SLEEP_HOURS).length,
    low: avg < LOW_SLEEP_HOURS,
    trend: trendText(
      "Rata-rata tidur",
      avg,
      average(ctx.previousLogs.map((log) => log.sleep_hours)),
      ctx.previousLogs.length,
      "jam",
    ),
  };
};

const waterStats = (ctx) => {
  const avg = average(ctx.windowLogs.map((log) => log.water_glasses));
  return {
    avg,
    lowDays: ctx.windowLogs.filter((log) => log.water_glasses < LOW_WATER_GLASSES).length,
    low: avg < LOW_WATER_GLASSES,
    trend: trendText(
      "Rata-rata cairan",
      avg,
      average(ctx.previousLogs.map((log) => log.water_glasses)),
      ctx.previousLogs.length,
      "gelas",
    ),
  };
};

const moodStats = (ctx) => {
  const lowDays = ctx.windowLogs.filter((log) => log.mood <= MOOD_LOW_MAX).length;
  return {
    lowDays,
    tiredDays: ctx.windowLogs.filter((log) => log.mood === 2).length,
    sadDays: ctx.windowLogs.filter((log) => log.mood === 1).length,
    low: lowDays >= MOOD_LOW_MIN_DAYS,
  };
};

const supplementLabelFor = (profile) =>
  profile === "teen" ? "Tablet Tambah Darah (TTD)" : "Suplemen";

const sleepInsight = (ctx) => {
  const s = sleepStats(ctx);
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: `${formatNumber(log.sleep_hours)} jam`,
    flagged: log.sleep_hours < LOW_SLEEP_HOURS,
  }));
  const basedOn = [`Rata-rata tidur: ${formatNumber(s.avg)} jam`];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Hari tercatat: ${ctx.total}`,
      `Rata-rata tidur: ${formatNumber(s.avg)} jam`,
      `Tidur kurang dari ${LOW_SLEEP_HOURS} jam: ${s.lowDays} hari`,
      ...(s.trend ? [s.trend] : []),
    ],
  };
  if (s.low) {
    return buildInsight({
      id: "sleep-low",
      fields: ["sleep"],
      category: "Perlu Diperhatikan",
      title: "Durasi tidur tercatat rendah",
      message: `Tidur tercatat kurang dari ${LOW_SLEEP_HOURS} jam pada ${s.lowDays} dari ${ctx.total} hari terakhir. Pola ini perlu diperhatikan.`,
      basedOn,
      action: "log",
      patternSummary: "Durasi tidur tercatat rendah selama periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena rata-rata tidur ${formatNumber(s.avg)} jam berada di bawah ${LOW_SLEEP_HOURS} jam, dengan ${s.lowDays} dari ${ctx.total} hari tercatat kurang dari ${LOW_SLEEP_HOURS} jam.`,
      actionText: "Lanjutkan pencatatan tidur dan pertimbangkan konsultasi dengan tenaga kesehatan bila pola ini berlanjut.",
    });
  }
  return buildInsight({
    id: "sleep-ok",
    fields: ["sleep"],
    category: "Perkembangan Baik",
    title: "Durasi tidur tercatat cukup",
    message: `Rata-rata tidur ${formatNumber(s.avg)} jam pada ${ctx.total} hari tercatat dalam ${ctx.period}.`,
    basedOn,
    action: "history",
    patternSummary: "Durasi tidur tercatat tidak berada di bawah batas pantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena rata-rata tidur ${formatNumber(s.avg)} jam tidak berada di bawah ${LOW_SLEEP_HOURS} jam.`,
    actionText: "Pertahankan pencatatan tidur secara rutin.",
  });
};

const hydrationInsight = (ctx) => {
  const w = waterStats(ctx);
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: `${log.water_glasses} gelas`,
    flagged: log.water_glasses < LOW_WATER_GLASSES,
  }));
  const basedOn = [`Rata-rata cairan: ${formatNumber(w.avg)} gelas`];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Hari tercatat: ${ctx.total}`,
      `Rata-rata cairan: ${formatNumber(w.avg)} gelas`,
      `Cairan kurang dari ${LOW_WATER_GLASSES} gelas: ${w.lowDays} hari`,
      ...(w.trend ? [w.trend] : []),
    ],
  };
  if (w.low) {
    return buildInsight({
      id: "hydration-low",
      fields: ["hydration"],
      category: "Perlu Diperhatikan",
      title: "Asupan cairan tercatat rendah",
      message: `Asupan cairan tercatat kurang dari ${LOW_WATER_GLASSES} gelas pada ${w.lowDays} dari ${ctx.total} hari terakhir. Pola ini perlu diperhatikan.`,
      basedOn,
      action: "log",
      patternSummary: "Asupan cairan tercatat rendah selama periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena rata-rata cairan ${formatNumber(w.avg)} gelas berada di bawah ${LOW_WATER_GLASSES} gelas, dengan ${w.lowDays} dari ${ctx.total} hari tercatat kurang dari ${LOW_WATER_GLASSES} gelas.`,
      actionText: "Lanjutkan pencatatan asupan cairan dan pertimbangkan konsultasi dengan tenaga kesehatan bila pola ini berlanjut.",
    });
  }
  return buildInsight({
    id: "hydration-ok",
    fields: ["hydration"],
    category: "Perkembangan Baik",
    title: "Asupan cairan tercatat cukup",
    message: `Rata-rata cairan ${formatNumber(w.avg)} gelas pada ${ctx.total} hari tercatat dalam ${ctx.period}.`,
    basedOn,
    action: "history",
    patternSummary: "Asupan cairan tercatat tidak berada di bawah batas pantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena rata-rata cairan ${formatNumber(w.avg)} gelas tidak berada di bawah ${LOW_WATER_GLASSES} gelas.`,
    actionText: "Pertahankan pencatatan asupan cairan secara rutin.",
  });
};

const moodInsight = (ctx) => {
  const m = moodStats(ctx);
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: MOOD_LABELS_ID[log.mood] ?? "Tidak dikenali",
    flagged: log.mood <= MOOD_LOW_MAX,
  }));
  const basedOn = [`Mood Lelah/Sedih: ${m.lowDays} dari ${ctx.total} hari`];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Hari tercatat: ${ctx.total}`,
      `Mood Lelah: ${m.tiredDays} hari`,
      `Mood Sedih: ${m.sadDays} hari`,
    ],
  };
  if (m.low) {
    return buildInsight({
      id: "mood-low",
      fields: ["mood"],
      category: "Perlu Diperhatikan",
      title: "Suasana hati kurang baik tercatat berulang",
      message: `Mood "Lelah" atau "Sedih" tercatat pada ${m.lowDays} dari ${ctx.total} hari terakhir. Pola ini perlu diperhatikan.`,
      basedOn,
      action: "consult",
      patternSummary: "Mood Lelah atau Sedih tercatat berulang selama periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena mood Lelah atau Sedih tercatat pada ${m.lowDays} dari ${ctx.total} hari (batas pantauan ${MOOD_LOW_MIN_DAYS} hari).`,
      actionText: "Lanjutkan pencatatan dan pertimbangkan konsultasi dengan tenaga kesehatan bila kondisi berlanjut.",
    });
  }
  return buildInsight({
    id: "mood-ok",
    fields: ["mood"],
    category: "Perkembangan Baik",
    title: "Suasana hati tercatat cukup stabil",
    message: `Mood Lelah atau Sedih tercatat ${m.lowDays} dari ${ctx.total} hari dalam ${ctx.period}.`,
    basedOn,
    action: "history",
    patternSummary: "Mood Lelah atau Sedih tidak tercatat berulang pada periode pemantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena mood Lelah atau Sedih tercatat ${m.lowDays} hari, di bawah batas pantauan ${MOOD_LOW_MIN_DAYS} hari.`,
    actionText: "Pertahankan pencatatan suasana hati secara rutin.",
  });
};

const supplementInsight = (ctx) => {
  const days = ctx.windowLogs.filter((log) => log.took_supplement).length;
  const missingDays = INSIGHT_WINDOW_DAYS - days;
  const label = supplementLabelFor(ctx.profile);
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: log.took_supplement ? "✓ Dikonsumsi" : "✕ Tidak dikonsumsi",
    flagged: !log.took_supplement,
  }));
  const basedOn = [`Suplemen tercatat: ${days}/${INSIGHT_WINDOW_DAYS} hari`];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Tercatat dikonsumsi: ${days} hari`,
      `Tidak tercatat: ${missingDays} hari (termasuk hari tanpa catatan)`,
    ],
  };
  if (days < MIN_SUPPLEMENT_DAYS) {
    return buildInsight({
      id: "supplement-irregular",
      fields: ["supplement"],
      category: "Pengingat",
      title: "Konsumsi suplemen belum rutin",
      message: `${label} tercatat ${days} dari ${INSIGHT_WINDOW_DAYS} hari terakhir. Catat konsumsi harianmu agar pola pencatatan tetap terpantau.`,
      basedOn,
      action: "log",
      patternSummary: "Pencatatan konsumsi suplemen belum konsisten selama periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena konsumsi suplemen tercatat pada ${days} dari ${INSIGHT_WINDOW_DAYS} hari terakhir sehingga pola pencatatan belum konsisten (batas ${MIN_SUPPLEMENT_DAYS} hari).`,
      actionText: "Lanjutkan pencatatan konsumsi suplemen secara rutin.",
    });
  }
  return buildInsight({
    id: "supplement-regular",
    fields: ["supplement"],
    category: "Perkembangan Baik",
    title: "Konsumsi suplemen tercatat rutin",
    message: `${label} tercatat ${days} dari ${INSIGHT_WINDOW_DAYS} hari terakhir. Pertahankan kebiasaan ini.`,
    basedOn,
    action: "history",
    patternSummary: "Konsumsi suplemen tercatat rutin selama periode pemantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena konsumsi suplemen tercatat pada ${days} dari ${INSIGHT_WINDOW_DAYS} hari terakhir (batas ${MIN_SUPPLEMENT_DAYS} hari).`,
    actionText: "Pertahankan pencatatan konsumsi suplemen secara rutin.",
  });
};

const cycleInsight = (ctx) => {
  const periodLogs = ctx.windowLogs.filter((log) => log.is_menstruating === true);
  if (periodLogs.length === 0) return null;
  const tookOnPeriod = periodLogs.filter((log) => log.took_supplement).length;
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: `${log.is_menstruating ? "Haid" : "Tidak haid"} · TTD ${log.took_supplement ? "✓" : "✕"}`,
    flagged: log.is_menstruating === true && !log.took_supplement,
  }));
  const basedOn = [
    `Haid tercatat: ${periodLogs.length} hari`,
    `TTD saat haid: ${tookOnPeriod}/${periodLogs.length} hari`,
  ];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Hari tercatat: ${ctx.total}`,
      `Haid tercatat: ${periodLogs.length} hari`,
      `TTD tercatat saat haid: ${tookOnPeriod} hari`,
    ],
  };
  if (tookOnPeriod < periodLogs.length) {
    return buildInsight({
      id: "cycle-supplement",
      fields: ["cycle", "supplement"],
      category: "Pengingat",
      title: "Konsumsi TTD saat haid belum konsisten",
      message: `Haid tercatat ${periodLogs.length} hari, dan TTD tercatat pada ${tookOnPeriod} hari di antaranya. Catat konsumsi harianmu agar polanya terpantau.`,
      basedOn,
      action: "log",
      patternSummary: "Konsumsi TTD tidak tercatat pada sebagian hari saat haid.",
      dataUsed,
      history,
      reason: `Insight muncul karena TTD tercatat pada ${tookOnPeriod} dari ${periodLogs.length} hari haid dalam ${ctx.period}.`,
      actionText: "Lanjutkan pencatatan konsumsi TTD, terutama pada hari haid.",
    });
  }
  return buildInsight({
    id: "cycle-supplement-ok",
    fields: ["cycle", "supplement"],
    category: "Perkembangan Baik",
    title: "Konsumsi TTD saat haid tercatat konsisten",
    message: `TTD tercatat pada seluruh ${periodLogs.length} hari haid dalam ${ctx.period}.`,
    basedOn,
    action: "history",
    patternSummary: "Konsumsi TTD tercatat pada seluruh hari haid dalam periode pemantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena TTD tercatat pada ${tookOnPeriod} dari ${periodLogs.length} hari haid.`,
    actionText: "Pertahankan pencatatan konsumsi TTD secara rutin.",
  });
};

const weightInsight = (ctx) => {
  const weights = ctx.weightLogs
    .filter((log) => isNum(log.weight_kg))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length < 2) return null;
  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = last.weight_kg - first.weight_kg;
  const outOfRange = last.weight_kg < WEIGHT_LOW_KG || last.weight_kg > WEIGHT_HIGH_KG;
  const periodText = periodLabel(WEIGHT_WINDOW_DAYS);
  const history = weights.map((log) => ({
    date: log.date,
    label: formatDayLabel(log.date),
    value: `${formatNumber(log.weight_kg)} kg`,
    state: log.weight_kg < WEIGHT_LOW_KG || log.weight_kg > WEIGHT_HIGH_KG ? "flag" : "ok",
  }));
  const changeText = `${change > 0 ? "+" : ""}${formatNumber(change)} kg`;
  const basedOn = [`Berat terakhir: ${formatNumber(last.weight_kg)} kg`, `Perubahan: ${changeText}`];
  const dataUsed = {
    period: periodText,
    items: [
      `Periode: ${periodText}`,
      `Pencatatan berat badan: ${weights.length} kali`,
      `Berat awal: ${formatNumber(first.weight_kg)} kg`,
      `Berat terakhir: ${formatNumber(last.weight_kg)} kg`,
      `Perubahan: ${changeText}`,
    ],
  };
  if (outOfRange || change < 0) {
    return buildInsight({
      id: "weight-attention",
      fields: ["weight"],
      category: "Perlu Diperhatikan",
      title: outOfRange ? "Berat badan tercatat di luar rentang pantauan" : "Berat badan tercatat menurun",
      message: outOfRange
        ? `Berat badan terakhir ${formatNumber(last.weight_kg)} kg berada di luar rentang ${WEIGHT_LOW_KG}–${WEIGHT_HIGH_KG} kg. Pola ini perlu diperhatikan.`
        : `Berat badan tercatat berubah ${changeText} dalam ${periodText}. Pola ini perlu diperhatikan.`,
      basedOn,
      action: "consult",
      patternSummary: outOfRange
        ? "Berat badan terakhir berada di luar rentang pantauan."
        : "Berat badan tercatat menurun selama periode pemantauan.",
      dataUsed,
      history,
      reason: outOfRange
        ? `Insight muncul karena berat badan terakhir ${formatNumber(last.weight_kg)} kg berada di luar rentang ${WEIGHT_LOW_KG}–${WEIGHT_HIGH_KG} kg.`
        : `Insight muncul karena berat badan berubah ${changeText} dari ${formatNumber(first.weight_kg)} kg menjadi ${formatNumber(last.weight_kg)} kg.`,
      actionText: "Pastikan pengukuran dilakukan dengan cara yang sama dan pertimbangkan konsultasi dengan tenaga kesehatan.",
    });
  }
  return buildInsight({
    id: "weight-progress",
    fields: ["weight"],
    category: "Perkembangan Baik",
    title: "Berat badan tercatat tidak menurun",
    message: `Berat badan tercatat berubah ${changeText} dalam ${periodText}.`,
    basedOn,
    action: "history",
    patternSummary: "Berat badan tercatat tidak menurun selama periode pemantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena berat badan berubah ${changeText} dan berat terakhir berada dalam rentang ${WEIGHT_LOW_KG}–${WEIGHT_HIGH_KG} kg.`,
    actionText: "Pertahankan pencatatan berat badan secara berkala dengan cara ukur yang sama.",
  });
};

const breastfeedingInsight = (ctx) => {
  const sessionLogs = ctx.windowLogs.filter((log) => isNum(log.breastfeeding_count));
  if (sessionLogs.length < MIN_LOGS_FOR_INSIGHT) return null;
  const avg = average(sessionLogs.map((log) => log.breastfeeding_count));
  const lowDays = sessionLogs.filter((log) => log.breastfeeding_count < LOW_BREASTFEEDING_SESSIONS).length;
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => ({
    value: isNum(log.breastfeeding_count) ? `${log.breastfeeding_count} sesi` : "Tidak diisi",
    flagged: isNum(log.breastfeeding_count) && log.breastfeeding_count < LOW_BREASTFEEDING_SESSIONS,
  }));
  const basedOn = [`Rata-rata sesi: ${formatNumber(avg)}/hari`];
  const dataUsed = {
    period: ctx.period,
    items: [
      `Periode: ${ctx.period}`,
      `Hari dengan data sesi: ${sessionLogs.length}`,
      `Rata-rata sesi: ${formatNumber(avg)} per hari`,
      `Kurang dari ${LOW_BREASTFEEDING_SESSIONS} sesi: ${lowDays} hari`,
    ],
  };
  if (avg < LOW_BREASTFEEDING_SESSIONS) {
    return buildInsight({
      id: "breastfeeding-low",
      fields: ["breastfeeding"],
      category: "Perlu Diperhatikan",
      title: "Frekuensi menyusui/memompa tercatat rendah",
      message: `Rata-rata ${formatNumber(avg)} sesi per hari, kurang dari ${LOW_BREASTFEEDING_SESSIONS} sesi pada ${lowDays} dari ${sessionLogs.length} hari. Pola ini perlu diperhatikan.`,
      basedOn,
      action: "consult",
      patternSummary: "Frekuensi menyusui/memompa tercatat rendah selama periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena rata-rata ${formatNumber(avg)} sesi per hari berada di bawah ${LOW_BREASTFEEDING_SESSIONS} sesi.`,
      actionText: "Lanjutkan pencatatan dan pertimbangkan konsultasi dengan tenaga kesehatan bila pola ini berlanjut.",
    });
  }
  if (avg < OPTIMAL_BREASTFEEDING_SESSIONS) {
    return buildInsight({
      id: "breastfeeding-below-target",
      fields: ["breastfeeding"],
      category: "Pengingat",
      title: "Frekuensi menyusui/memompa di bawah target",
      message: `Rata-rata ${formatNumber(avg)} sesi per hari, di bawah target ${OPTIMAL_BREASTFEEDING_SESSIONS} sesi. Catat sesi harianmu agar polanya terpantau.`,
      basedOn,
      action: "log",
      patternSummary: "Frekuensi menyusui/memompa tercatat di bawah target pada periode pemantauan.",
      dataUsed,
      history,
      reason: `Insight muncul karena rata-rata ${formatNumber(avg)} sesi per hari berada di bawah target ${OPTIMAL_BREASTFEEDING_SESSIONS} sesi.`,
      actionText: "Lanjutkan pencatatan sesi menyusui/memompa setiap hari.",
    });
  }
  return buildInsight({
    id: "breastfeeding-ok",
    fields: ["breastfeeding"],
    category: "Perkembangan Baik",
    title: "Frekuensi menyusui/memompa tercatat baik",
    message: `Rata-rata ${formatNumber(avg)} sesi per hari dalam ${ctx.period}.`,
    basedOn,
    action: "history",
    patternSummary: "Frekuensi menyusui/memompa tercatat memenuhi target pada periode pemantauan.",
    dataUsed,
    history,
    reason: `Insight muncul karena rata-rata ${formatNumber(avg)} sesi per hari mencapai target ${OPTIMAL_BREASTFEEDING_SESSIONS} sesi.`,
    actionText: "Pertahankan pencatatan sesi secara rutin.",
  });
};

const loggingInsight = (ctx, supportingPositives) => {
  if (ctx.total < GOOD_LOGGING_MIN_DAYS) return null;
  const history = buildHistory(ctx.windowDates, ctx.byDate, () => ({
    value: "✓ Tercatat",
    flagged: false,
  }));
  return buildInsight({
    id: "good-progress",
    fields: ["logging"],
    category: "Perkembangan Baik",
    title: "Pencatatan kesehatan menunjukkan perkembangan positif",
    message: `Pencatatan dilakukan pada ${ctx.total} dari ${INSIGHT_WINDOW_DAYS} hari terakhir. Pertahankan kebiasaan monitoring secara rutin.`,
    basedOn: [`Log tercatat: ${ctx.total}/${INSIGHT_WINDOW_DAYS} hari`, ...supportingPositives],
    action: "history",
    patternSummary: "Pencatatan dilakukan secara konsisten pada sebagian besar hari dalam periode pemantauan.",
    dataUsed: {
      period: ctx.period,
      items: [
        `Periode: ${ctx.period}`,
        `Tercatat: ${ctx.total} hari`,
        `Tidak tercatat: ${INSIGHT_WINDOW_DAYS - ctx.total} hari`,
      ],
    },
    history,
    reason: `Insight muncul karena Health Log tercatat pada ${ctx.total} dari ${INSIGHT_WINDOW_DAYS} hari terakhir (batas ${GOOD_LOGGING_MIN_DAYS} hari).`,
    actionText: "Pertahankan kebiasaan pencatatan secara rutin.",
  });
};

const combinedInsight = (ctx, flags) => {
  const sleep = sleepStats(ctx);
  const water = waterStats(ctx);
  const mood = moodStats(ctx);
  const parts = [];
  const basedOn = [];
  const items = [`Periode: ${ctx.period}`, `Hari tercatat: ${ctx.total}`];
  const names = [];
  const reasons = [];
  if (flags.mood) {
    names.push("suasana hati");
    parts.push(`Mood "Lelah" atau "Sedih" tercatat pada ${mood.lowDays} dari ${ctx.total} hari terakhir.`);
    basedOn.push(`Mood Lelah/Sedih: ${mood.lowDays} hari`);
    items.push(`Mood Lelah: ${mood.tiredDays} hari`, `Mood Sedih: ${mood.sadDays} hari`);
    reasons.push(`mood Lelah atau Sedih tercatat ${mood.lowDays} hari`);
  }
  if (flags.sleep) {
    names.push("tidur");
    parts.push(`Tidur tercatat kurang dari ${LOW_SLEEP_HOURS} jam pada ${sleep.lowDays} dari ${ctx.total} hari terakhir.`);
    basedOn.push(`Rata-rata tidur: ${formatNumber(sleep.avg)} jam`);
    items.push(`Rata-rata tidur: ${formatNumber(sleep.avg)} jam`);
    reasons.push(`rata-rata tidur ${formatNumber(sleep.avg)} jam`);
  }
  if (flags.hydration) {
    names.push("asupan cairan");
    parts.push(`Asupan cairan tercatat kurang dari ${LOW_WATER_GLASSES} gelas pada ${water.lowDays} dari ${ctx.total} hari terakhir.`);
    basedOn.push(`Rata-rata cairan: ${formatNumber(water.avg)} gelas`);
    items.push(`Rata-rata cairan: ${formatNumber(water.avg)} gelas`);
    reasons.push(`rata-rata cairan ${formatNumber(water.avg)} gelas`);
  }
  const hasMood = flags.mood;
  const urgent = hasMood && mood.lowDays >= MOOD_LOW_URGENT_DAYS;
  const title = hasMood
    ? "Kelelahan tercatat berulang"
    : "Tidur dan asupan cairan tercatat rendah";
  const history = buildHistory(ctx.windowDates, ctx.byDate, (log) => {
    const cells = [];
    if (flags.mood) cells.push(MOOD_LABELS_ID[log.mood] ?? "Mood tidak dikenali");
    if (flags.sleep) cells.push(`${formatNumber(log.sleep_hours)} jam`);
    if (flags.hydration) cells.push(`${log.water_glasses} gelas`);
    return {
      value: cells.join(" · "),
      flagged:
        (flags.mood && log.mood <= MOOD_LOW_MAX) ||
        (flags.sleep && log.sleep_hours < LOW_SLEEP_HOURS) ||
        (flags.hydration && log.water_glasses < LOW_WATER_GLASSES),
    };
  });
  return buildInsight({
    id: hasMood ? "recurring-fatigue" : "low-sleep-and-water",
    fields: [...(flags.mood ? ["mood"] : []), ...(flags.sleep ? ["sleep"] : []), ...(flags.hydration ? ["hydration"] : [])],
    category: urgent ? "Segera Konsultasi" : "Perlu Diperhatikan",
    title,
    message: `${parts.join(" ")} ${urgent ? "Pola ini sebaiknya dikonsultasikan dengan tenaga kesehatan." : "Pola ini perlu diperhatikan."}`,
    basedOn,
    action: "consult",
    patternSummary: `Data ${joinNames(names)} sama-sama menunjukkan pola yang perlu diperhatikan dalam periode pemantauan.`,
    dataUsed: { period: ctx.period, items },
    history,
    reason: `Insight muncul karena ${joinNames(reasons)} tercatat bersamaan pada periode yang sama, sehingga pola ini perlu diperhatikan.`,
    actionText: "Lanjutkan pencatatan dan pertimbangkan konsultasi dengan tenaga kesehatan bila kondisi berlanjut.",
  });
};

const gateInsight = ({ id, title, message, basedOn, patternSummary, items, history, reason, action = "log", actionText }) =>
  buildInsight({
    id,
    fields: ["data"],
    category: id === "logging-stopped" ? "Pengingat" : "Cek Data",
    title,
    message,
    basedOn,
    action,
    patternSummary,
    dataUsed: { period: periodLabel(INSIGHT_WINDOW_DAYS), items },
    history,
    reason,
    actionText,
  });

const selectInsights = (insights) =>
  [...insights]
    .sort(
      (a, b) =>
        INSIGHT_CATEGORY_PRIORITY.indexOf(a.category) -
        INSIGHT_CATEGORY_PRIORITY.indexOf(b.category),
    )
    .slice(0, MAX_INSIGHTS);

const analyzeHealthLogs = (logs = [], today = todayUTC()) => {
  const empty = (insights) => ({ insights, fieldInsights: {} });
  const windowText = periodLabel(INSIGHT_WINDOW_DAYS);

  if (!Array.isArray(logs) || logs.length === 0) {
    return empty([
      gateInsight({
        id: "insufficient-data",
        title: "Data belum cukup",
        message: "Belum ada catatan Health Log. Tambahkan catatan secara berkala untuk mendapatkan insight yang lebih lengkap.",
        basedOn: ["Log tercatat: 0 hari"],
        patternSummary: "Data belum cukup untuk melihat pola.",
        items: [`Periode: ${windowText}`, "Tercatat: 0 hari"],
        history: [],
        reason: "Insight muncul karena belum ada catatan Health Log yang dapat digunakan.",
        actionText: "Mulai catat kondisi harian melalui Log Entry.",
      }),
    ]);
  }

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sortedLogs[0];

  const daysSinceLastLog = daysBetween(latest.date, today);
  if (daysSinceLastLog >= INSIGHT_WINDOW_DAYS) {
    return empty([
      gateInsight({
        id: "logging-stopped",
        title: "Pencatatan terhenti",
        message: `Catatan terakhir tercatat ${daysSinceLastLog} hari yang lalu. Lanjutkan pencatatan agar pola kesehatanmu tetap terpantau.`,
        basedOn: [`Log terakhir: ${daysSinceLastLog} hari lalu`],
        patternSummary: "Pencatatan tidak dilakukan selama periode pemantauan.",
        items: [`Periode: ${windowText}`, `Catatan terakhir: ${formatDayLabel(latest.date)}`, "Tercatat pada periode ini: 0 hari"],
        history: [{ date: latest.date, label: formatDayLabel(latest.date), value: "Catatan terakhir", state: "ok" }],
        reason: `Insight muncul karena catatan terakhir sudah ${daysSinceLastLog} hari yang lalu (batas ${INSIGHT_WINDOW_DAYS} hari).`,
        actionText: "Lanjutkan pencatatan melalui Log Entry.",
      }),
    ]);
  }

  const profile = latest.profile_type;
  const sameProfile = sortedLogs.filter((log) => log.profile_type === profile);
  const diffOf = (log) => daysBetween(log.date, today);
  const windowLogs = sameProfile.filter((log) => diffOf(log) >= 0 && diffOf(log) < INSIGHT_WINDOW_DAYS);
  const previousLogs = sameProfile.filter(
    (log) => diffOf(log) >= INSIGHT_WINDOW_DAYS && diffOf(log) < INSIGHT_WINDOW_DAYS + PREVIOUS_WINDOW_DAYS,
  );
  const weightLogs = sameProfile.filter((log) => diffOf(log) >= 0 && diffOf(log) < WEIGHT_WINDOW_DAYS);
  const ctx = buildContext(profile, windowLogs, previousLogs, weightLogs, today);

  const { reasons, flaggedDates } = findInvalidDataReasons(windowLogs, weightLogs);
  if (reasons.length > 0) {
    const flaggedHistory = [...flaggedDates]
      .sort()
      .map((date) => ({ date, label: formatDayLabel(date), value: "Perlu diperiksa", state: "flag" }));
    return empty([
      gateInsight({
        id: "invalid-data",
        title: "Periksa kembali data catatan",
        message: "Ada data yang tercatat di luar rentang wajar sehingga belum dapat ditafsirkan. Periksa kembali catatanmu.",
        basedOn: reasons,
        patternSummary: "Sebagian data tidak memenuhi validasi sehingga insight tidak dihasilkan.",
        items: [`Periode: ${windowText}`, ...reasons],
        history: flaggedHistory,
        reason: "Insight muncul karena ada nilai yang tidak valid; data mentah tidak diubah dan tidak digunakan untuk menafsirkan pola.",
        action: "check",
        actionText: "Periksa dan perbarui catatan yang bersangkutan melalui riwayat.",
      }),
    ]);
  }

  if (ctx.total < MIN_LOGS_FOR_INSIGHT) {
    return empty([
      gateInsight({
        id: "insufficient-data",
        title: "Data belum cukup",
        message: `Baru ${ctx.total} catatan dalam ${windowText}. Tambahkan catatan secara berkala (minimal ${MIN_LOGS_FOR_INSIGHT} hari) untuk mendapatkan insight yang lebih lengkap.`,
        basedOn: [`Log tercatat: ${ctx.total}/${INSIGHT_WINDOW_DAYS} hari`],
        patternSummary: "Data belum cukup untuk melihat pola.",
        items: [`Periode: ${windowText}`, `Tercatat: ${ctx.total} hari`, `Tidak tercatat: ${INSIGHT_WINDOW_DAYS - ctx.total} hari`],
        history: buildHistory(ctx.windowDates, ctx.byDate, () => ({ value: "✓ Tercatat", flagged: false })),
        reason: `Insight muncul karena baru ${ctx.total} hari tercatat, di bawah batas ${MIN_LOGS_FOR_INSIGHT} hari.`,
        actionText: "Lanjutkan pencatatan secara berkala.",
      }),
    ]);
  }

  const fieldInsights = {
    sleep: sleepInsight(ctx),
    hydration: hydrationInsight(ctx),
    mood: moodInsight(ctx),
    supplement: supplementInsight(ctx),
  };
  if (profile === "teen") fieldInsights.cycle = cycleInsight(ctx);
  if (profile === "pregnant") fieldInsights.weight = weightInsight(ctx);
  if (profile === "breastfeeding") fieldInsights.breastfeeding = breastfeedingInsight(ctx);
  Object.keys(fieldInsights).forEach((key) => {
    if (!fieldInsights[key]) delete fieldInsights[key];
  });

  const isAttention = (insight) => insight && insight.category !== "Perkembangan Baik";
  const flags = {
    sleep: isAttention(fieldInsights.sleep),
    hydration: isAttention(fieldInsights.hydration),
    mood: isAttention(fieldInsights.mood),
  };
  const flaggedCount = Object.values(flags).filter(Boolean).length;

  const cards = [];
  if (flaggedCount >= 2) {
    cards.push(combinedInsight(ctx, flags));
  } else {
    ["mood", "sleep", "hydration"].forEach((key) => {
      if (flags[key]) cards.push(fieldInsights[key]);
    });
  }
  ["supplement", "cycle", "weight", "breastfeeding"].forEach((key) => {
    if (isAttention(fieldInsights[key])) cards.push(fieldInsights[key]);
  });
  const hasCycleCard = cards.some((card) => card.id === "cycle-supplement");
  const deduped = hasCycleCard ? cards.filter((card) => card.id !== "supplement-irregular") : cards;

  const positives = Object.values(fieldInsights)
    .filter((insight) => insight.category === "Perkembangan Baik")
    .map((insight) => insight.based_on[0]);
  const progress = loggingInsight(ctx, positives.slice(0, 2));
  if (progress) deduped.push(progress);

  return { insights: selectInsights(deduped), fieldInsights };
};

const generateInsights = (logs = [], today = todayUTC()) =>
  analyzeHealthLogs(logs, today).insights;

const getInsight = async (userId) => {
  const today = todayUTC();
  const [log, logs] = await Promise.all([
    prisma.logKesehatan.findUnique({
      where: {
        userId_tanggalCatat: {
          userId,
          tanggalCatat: today,
        },
      },
    }),
    getAllLogs(userId),
  ]);

  const { insights, fieldInsights } = analyzeHealthLogs(logs, today);

  if (!log) {
    return { has_log_today: false, insights, field_insights: fieldInsights };
  }

  const hydrationTarget = HYDRATION_TARGETS[log.fase] ?? 8;
  const hydrationPercent = Math.min(
    Math.round((log.jumlahGelasAir / hydrationTarget) * 100),
    100,
  );
  const sleepPercent = Math.min(Math.round((log.durasiTidur / 8) * 100), 100);

  return {
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
    insights,
    field_insights: fieldInsights,
  };
};

const getNotifications = async (userId) => {
  const today = todayUTC();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);
  const [log, nextConsultation] = await Promise.all([
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
  ]);
  const notifications = [];
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
  if (log && log.fase === "REMAJA" && log.sedangHaid === true) {
    notifications.push({
      type: "menstruation",
      message:
        "Sedang masa haid? Pastikan hidrasi dan asupan zat besi terjaga hari ini ya.",
    });
  }
  if (nextConsultation) {
    notifications.push({
      type: "anc_reminder",
      message:
        "Persiapan Kontrol: Besok adalah jadwal kunjungan ke dokter/bidan. Pastikan Bunda sudah siap!",
    });
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
  deleteLog,
  getInsight,
  getNotifications,
  generateInsights,
  analyzeHealthLogs,
};