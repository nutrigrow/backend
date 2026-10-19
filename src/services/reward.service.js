const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

// ─── Constants & Configurations ───────────────────────────────────────────────
const REWARD_CATALOG = [
  {
    id: 'v-20k',
    title: 'Voucher NutriShop Rp20.000',
    description: 'Diskon belanja produk bahan pangan bernutrisi di NutriShop.',
    cost: 200,
    category: 'VOUCHER',
    isActive: true,
  },
  {
    id: 'v-50k',
    title: 'Voucher NutriShop Rp50.000',
    description: 'Potongan belanja susu fortified & sereal kaya mikronutrien.',
    cost: 500,
    category: 'VOUCHER',
    isActive: true,
  },
  {
    id: 'tele-1',
    title: '1 Sesi Tele-Nutrition Gratis',
    description: 'Konsultasi 30 menit bersama dokter spesialis gizi anak NutriGrow.',
    cost: 800,
    category: 'SERVICE',
    isActive: true,
  },
  {
    id: 'starter',
    title: 'NutriGrow Starter Package',
    description: 'Box set suplemen zinc, zat besi, dan vitamin D untuk 30 hari.',
    cost: 1200,
    category: 'PHYSICAL',
    isActive: true,
  },
];

const LEVEL_THRESHOLDS = [
  { name: 'Pemula', minPoints: 0, nextTarget: 500, nextLevelName: 'Konsisten' },
  { name: 'Konsisten', minPoints: 500, nextTarget: 1000, nextLevelName: 'Berdedikasi' },
  { name: 'Berdedikasi', minPoints: 1000, nextTarget: 2500, nextLevelName: 'Inspiratif' },
  { name: 'Inspiratif', minPoints: 2500, nextTarget: 5000, nextLevelName: 'Duta Nutrisi' },
  { name: 'Duta Nutrisi', minPoints: 5000, nextTarget: 5000, nextLevelName: null },
];

const STREAK_MILESTONES = {
  3: 15,
  7: 50,
  30: 200,
};

const getTodayDateStr = (date = new Date()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateLevel = (totalEarnedPoints) => {
  let current = LEVEL_THRESHOLDS[0];
  for (const lvl of LEVEL_THRESHOLDS) {
    if (totalEarnedPoints >= lvl.minPoints) {
      current = lvl;
    }
  }
  return {
    levelName: current.name,
    nextLevelName: current.nextLevelName,
    nextLevelTarget: current.nextTarget,
  };
};

/**
 * Hitung streak aktif (hari berturut-turut mengisi Health Log hingga hari ini atau kemarin)
 */
const calculateUserStreak = async (userId, now = new Date()) => {
  if (!prisma.logKesehatan || !prisma.logKesehatan.findMany) return 0;
  const logs = await prisma.logKesehatan.findMany({
    where: { userId },
    select: { tanggalCatat: true },
    orderBy: { tanggalCatat: 'desc' },
  });

  if (!Array.isArray(logs) || logs.length === 0) return 0;

  const dateSet = new Set(
    logs.map((l) =>
      (l.tanggalCatat instanceof Date ? l.tanggalCatat.toISOString() : String(l.tanggalCatat)).slice(0, 10)
    )
  );

  const runner = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = getTodayDateStr(runner);
  runner.setUTCDate(runner.getUTCDate() - 1);
  const yesterdayStr = getTodayDateStr(runner);

  // Jika hari ini atau kemarin tidak ada log, streak putus (0)
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
    return 0;
  }

  // Hitung mundur hari berturut-turut
  let streak = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!dateSet.has(getTodayDateStr(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (dateSet.has(getTodayDateStr(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
};

// ─── Core Point Ledger Functions ──────────────────────────────────────────────

/**
 * Tambah poin dengan proteksi idempotency berdasarkan referensiId
 */
const awardPoints = async (userId, { jenisAktivitas, poin, deskripsi, referensiId }) => {
  if (poin <= 0 || !prisma.poinTransaksi) return null;

  if (referensiId) {
    const existing = await prisma.poinTransaksi.findFirst({
      where: { userId, referensiId },
    });
    if (existing) {
      return existing; // Sudah pernah diberikan, hindari duplikasi
    }
  }

  const tx = await prisma.poinTransaksi.create({
    data: {
      userId,
      jenisAktivitas,
      poin,
      deskripsi,
      referensiId,
    },
  });

  return tx;
};

/**
 * Cek dan berikan bonus streak jika mencapai milestone 3, 7, atau 30 hari.
 * Menggunakan referensiId unik agar tidak terduplikasi per siklus streak.
 */
const checkAndAwardStreakBonus = async (userId, currentStreak, now = new Date()) => {
  if (!currentStreak || currentStreak < 3) return null;

  for (const [daysStr, bonusPts] of Object.entries(STREAK_MILESTONES)) {
    const days = parseInt(daysStr, 10);
    if (currentStreak >= days) {
      // Hitung tanggal awal streak untuk mengunci milestone siklus ini
      const streakStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentStreak + 1);
      const streakStartStr = getTodayDateStr(streakStartDate);
      const referensiId = `STREAK_${days}_${streakStartStr}`;

      await awardPoints(userId, {
        jenisAktivitas: 'BONUS_STREAK',
        poin: bonusPts,
        deskripsi: `Bonus Streak ${days} Hari Tercapai`,
        referensiId,
      });
    }
  }
};

/**
 * Ambil ringkasan reward (saldo poin, level, streak, target)
 */
const getRewardSummary = async (userId) => {
  const [ledger, streakDays] = await Promise.all([
    prisma.poinTransaksi.findMany({
      where: { userId },
      select: { poin: true },
    }),
    calculateUserStreak(userId),
  ]);

  await checkAndAwardStreakBonus(userId, streakDays);

  const refreshedLedger = await prisma.poinTransaksi.findMany({
    where: { userId },
    select: { poin: true },
  });

  const activePoints = refreshedLedger.reduce((sum, item) => sum + item.poin, 0);
  const totalEarned = refreshedLedger
    .filter((item) => item.poin > 0)
    .reduce((sum, item) => sum + item.poin, 0);

  const levelInfo = calculateLevel(totalEarned);

  // Tentukan bonus streak berikutnya
  let streakBonus = 50;
  if (streakDays < 3) streakBonus = 15;
  else if (streakDays < 7) streakBonus = 50;
  else streakBonus = 200;

  return {
    points: Math.max(0, activePoints),
    totalEarnedPoints: totalEarned,
    levelName: levelInfo.levelName,
    nextLevelName: levelInfo.nextLevelName,
    nextLevelTarget: levelInfo.nextLevelTarget,
    streakDays,
    streakBonus,
  };
};

/**
 * Ambil katalog reward
 */
const getCatalog = async () => {
  return REWARD_CATALOG;
};

/**
 * Ambil status misi harian
 */
const getMissionsStatus = async (userId) => {
  const today = new Date();
  const todayDateStr = getTodayDateStr(today);
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

  const [growthToday, healthLogsToday, articlesReadToday, teleSessionsToday] = await Promise.all([
    // Log pertumbuhan anak hari ini
    prisma.rekamPertumbuhan.count({
      where: {
        balita: { userId },
        tanggalCatat: { gte: startOfDay, lt: endOfDay },
      },
    }),
    // Health log kategori berbeda hari ini
    prisma.logKesehatan.findMany({
      where: {
        userId,
        tanggalCatat: { gte: startOfDay, lt: endOfDay },
      },
      select: { fase: true },
    }),
    // Artikel dibaca hari ini
    prisma.riwayatBacaArtikel.count({
      where: {
        userId,
        tanggalBaca: startOfDay,
      },
    }),
    // Sesi Tele-Nutrition yang selesai hari ini
    prisma.konsultasi.count({
      where: {
        userId,
        status: 'DONE',
        updatedAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
  ]);

  const uniqueFaseCount = new Set(healthLogsToday.map((l) => l.fase)).size;

  return [
    {
      id: 'log-tb-bb',
      title: 'Log Tinggi & Berat Badan',
      subtitle: '+20 Poin per log (Maks 1x/hari)',
      tone: 'green',
      icon: 'IconScale',
      status: growthToday > 0 ? 'done' : 'action',
      actionLabel: growthToday > 0 ? 'Selesai' : 'Catat',
      to: '/growth-tracker',
      progress: Math.min(growthToday, 1),
      max: 1,
    },
    {
      id: 'log-gizi',
      title: 'Health Log Asupan Gizi',
      subtitle: `+10 Poin (Progres ${Math.min(uniqueFaseCount, 3)}/3 Kategori)`,
      tone: 'orange',
      icon: 'IconUtensils',
      status: uniqueFaseCount >= 3 ? 'done' : 'action',
      actionLabel: uniqueFaseCount >= 3 ? 'Selesai' : 'Lanjut',
      to: '/health-log',
      progress: Math.min(uniqueFaseCount, 3),
      max: 3,
    },
    {
      id: 'edu-mpasi',
      title: 'Baca Edukasi MPASI & Nutrisi',
      subtitle: `+5 Poin (${Math.min(articlesReadToday, 3)}/3 Artikel)`,
      tone: 'blue',
      icon: 'IconBookOpen',
      status: articlesReadToday >= 3 ? 'done' : 'action',
      actionLabel: articlesReadToday >= 3 ? 'Selesai' : 'Baca',
      to: '/artikel',
      progress: Math.min(articlesReadToday, 3),
      max: 3,
    },
    {
      id: 'tele-nutri',
      title: 'Konsultasi Tele-Nutrition',
      subtitle: '+50 Poin / Sesi Selesai',
      tone: 'purple',
      icon: 'IconVideo',
      status: teleSessionsToday > 0 ? 'done' : 'action',
      actionLabel: teleSessionsToday > 0 ? 'Selesai' : 'Jadwal',
      to: '/tele-nutritionist',
      progress: teleSessionsToday,
      max: 1,
    },
  ];
};

/**
 * Catat aktivitas membaca artikel dan berikan 5 poin (maks 3 artikel/hari)
 */
const recordArticleRead = async (userId, artikelId) => {
  const today = new Date();
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Cek berapa artikel yang sudah dibaca hari ini
  const countToday = await prisma.riwayatBacaArtikel.count({
    where: {
      userId,
      tanggalBaca: startOfDay,
    },
  });

  const parsedArticleId = parseInt(artikelId, 10);

  // Catat riwayat baca artikel (idempotent via unique constraint)
  try {
    await prisma.riwayatBacaArtikel.create({
      data: {
        userId,
        artikelId: parsedArticleId,
        tanggalBaca: startOfDay,
      },
    });
  } catch (err) {
    // Jika sudah pernah dicatat hari ini, abaikan
    return { awarded: false, message: 'Artikel sudah pernah dibaca hari ini' };
  }

  // Jika belum melebihi limit harian (3 artikel), berikan 5 poin
  if (countToday < 3) {
    const todayStr = getTodayDateStr(today);
    await awardPoints(userId, {
      jenisAktivitas: 'BACA_ARTIKEL',
      poin: 5,
      deskripsi: 'Baca Artikel Edukasi Nutrisi',
      referensiId: `READ_ARTICLE_${userId}_${parsedArticleId}_${todayStr}`,
    });
    return { awarded: true, pointsAwarded: 5, message: 'Berhasil mendapatkan 5 poin' };
  }

  return { awarded: false, message: 'Batas harian membaca artikel tercapai (maks 3 artikel/hari)' };
};

/**
 * Tukar reward (Redeem)
 */
const redeemReward = async (userId, rewardId) => {
  const reward = REWARD_CATALOG.find((r) => r.id === rewardId && r.isActive);
  if (!reward) {
    throw ApiError.badRequest('Reward tidak valid atau tidak tersedia');
  }

  // Gunakan database transaction untuk atomic validation & balance deduction
  const result = await prisma.$transaction(async (tx) => {
    const userLedger = await tx.poinTransaksi.findMany({
      where: { userId },
      select: { poin: true },
    });

    const currentBalance = userLedger.reduce((sum, item) => sum + item.poin, 0);

    if (currentBalance < reward.cost) {
      throw ApiError.badRequest(
        `Saldo poin tidak mencukupi. Anda memiliki ${currentBalance} poin, dibutuhkan ${reward.cost} poin.`
      );
    }

    // Catat penukaran hadiah
    const redemption = await tx.penukaranHadiah.create({
      data: {
        userId,
        rewardId: reward.id,
        namaHadiah: reward.title,
        biayaPoin: reward.cost,
        status: 'SUCCESS',
      },
    });

    // Catat transaksi pengurangan poin di ledger
    const ledgerEntry = await tx.poinTransaksi.create({
      data: {
        userId,
        jenisAktivitas: 'TUKAR_HADIAH',
        poin: -reward.cost,
        deskripsi: `Tukar ${reward.title}`,
        referensiId: `REDEEM_${redemption.id}`,
      },
    });

    return {
      redemptionId: redemption.id,
      reward: reward.title,
      cost: reward.cost,
      remainingPoints: currentBalance - reward.cost,
      createdAt: redemption.createdAt,
    };
  });

  return result;
};

/**
 * Ambil riwayat transaksi poin
 */
const getPointHistory = async (userId, limit = 20) => {
  const history = await prisma.poinTransaksi.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return history.map((tx) => {
    const isIncome = tx.poin > 0;
    let tone = 'green';
    let icon = 'IconCheckCircle';

    if (!isIncome) {
      tone = 'red';
      icon = 'IconGift';
    } else if (tx.jenisAktivitas === 'BONUS_STREAK') {
      tone = 'yellow';
      icon = 'IconFlame';
    } else if (tx.jenisAktivitas === 'LOG_PERTUMBUHAN') {
      tone = 'green';
      icon = 'IconPlusCircle';
    }

    return {
      id: String(tx.id),
      title: tx.deskripsi,
      time: tx.createdAt,
      amount: tx.poin,
      tone,
      icon,
    };
  });
};

module.exports = {
  REWARD_CATALOG,
  LEVEL_THRESHOLDS,
  STREAK_MILESTONES,
  calculateUserStreak,
  awardPoints,
  checkAndAwardStreakBonus,
  getRewardSummary,
  getCatalog,
  getMissionsStatus,
  recordArticleRead,
  redeemReward,
  getPointHistory,
};
