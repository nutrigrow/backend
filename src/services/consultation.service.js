const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const midtransClient = require('midtrans-client');
const childrenService = require("./children.service");

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MIDTRANS_READY = Boolean(MIDTRANS_SERVER_KEY && MIDTRANS_CLIENT_KEY);

let snap = null;
if (MIDTRANS_READY) {
    snap = new midtransClient.Snap({
        isProduction: MIDTRANS_IS_PRODUCTION,
        serverKey: MIDTRANS_SERVER_KEY,
        clientKey: MIDTRANS_CLIENT_KEY
    });
}

/**
 * Check availability for a specialist on a specific date
 */
const getAvailability = async (specialistId, dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);

  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayName = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta'
  }).format(refDate);

  const specialist = await prisma.profilAhliGizi.findUnique({
    where: { id: Number(specialistId) },
    select: {
      jadwal: true,
      isAvailable: true,
      user: {
        select: {
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (
    !specialist ||
    !specialist.jadwal ||
    !specialist.isAvailable ||
    !specialist.user?.isActive ||
    specialist.user?.deletedAt
  ) {
    throw ApiError.notFound("Jadwal spesialis tidak ditemukan");
  }

  const { hari, waktu } = specialist.jadwal;

  if (!hari.includes(dayName)) {
    return []; 
  }

  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const startOfDay = new Date(midnightUtc - wibOffsetMs); 
  const endOfDay   = new Date(midnightUtc - wibOffsetMs + 24 * 60 * 60 * 1000 - 1);  

  const existingBookings = await prisma.konsultasi.findMany({
    where: {
      ahliGiziId: Number(specialistId),
      jadwalSesi: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: {
        in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS']
      }
    },
    select: { jadwalSesi: true }
  });

  const bookedTimes = existingBookings.map(b => {
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(b.jadwalSesi.getTime() + wibOffset);
    const hh = String(wibDate.getUTCHours()).padStart(2, '0');
    const mm = String(wibDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta'
  }).format(now);

  return waktu.map(t => {
    let isAvailable = !bookedTimes.includes(t);

    if (isAvailable && dateStr === todayStr) {
      const slotTime = new Date(`${dateStr}T${t}:00+07:00`);
      if (slotTime.getTime() <= now.getTime()) {
        isAvailable = false;
      }
    }

    return {
      time: t,
      isAvailable
    };
  });
};

/**
 * Create a new booking
 */
const createBooking = async (userId, body) => {
  const { ahliGiziId, jadwalSesi, metode } = body;
  const date = new Date(jadwalSesi);

  const specialist = await prisma.profilAhliGizi.findUnique({
    where: { id: Number(ahliGiziId) },
    include: { user: true }
  });

  if (!specialist) throw ApiError.notFound("Spesialis tidak ditemukan");
  if (!specialist.isAvailable || !specialist.user?.isActive || specialist.user?.deletedAt) {
    throw ApiError.notFound("Spesialis tidak ditemukan");
  }

  const harga = metode === 'VIDEO_CALL' ? specialist.biayaVideoCall : specialist.biayaChat;
  const pajak = Math.round(harga * 0.1);
  const totalHarga = harga + pajak;

  const orderId = `CONS-${Date.now()}-${userId}`;

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.konsultasi.findFirst({
      where: {
        ahliGiziId: Number(ahliGiziId),
        jadwalSesi: date,
        status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] }
      }
    });
    if (existing) throw ApiError.badRequest("Jadwal sudah terisi, silakan pilih waktu lain");

    const transaksi = await tx.transaksi.create({
      data: {
        userId,
        midtransOrderId: orderId,
        jenisTransaksi: 'TELE_NUTRITIONIST',
        totalHarga,
        statusBayar: 'PENDING',
      }
    });

    const konsultasi = await tx.konsultasi.create({
      data: {
        userId,
        ahliGiziId: Number(ahliGiziId),
        transaksiId: transaksi.id,
        jadwalSesi: date,
        metode,
        status: 'BOOKED',
      },
      include: {
        ahliGizi: {
          include: { user: { select: { nama: true } } }
        }
      }
    });

    let snapToken = null;
    let snapRedirectUrl = null;

    if (snap) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: totalHarga
        },
        item_details: [
          {
            id: `CONS-${metode}`,
            price: harga,
            quantity: 1,
            name: `Konsultasi ${metode === 'VIDEO_CALL' ? 'Video' : 'Chat'} - ${specialist.user.nama}`
          },
          {
            id: 'TAX',
            price: pajak,
            quantity: 1,
            name: 'Pajak (10%)'
          }
        ],
        customer_details: {
          first_name: user.nama,
          email: user.email,
        }
      };

      const snapResponse = await snap.createTransaction(parameter);
      snapToken = snapResponse.token;
      snapRedirectUrl = snapResponse.redirect_url;

      await tx.transaksi.update({
        where: { id: transaksi.id },
        data: { snapToken }
      });
    }

    return {
      konsultasi,
      snapToken,
      snapRedirectUrl
    };
  });
};

/**
 * Get user's consultations
 */
const getMyConsultations = async (userId) => {
  return prisma.konsultasi.findMany({
    where: { userId },
    include: {
      ahliGizi: {
        include: { user: { select: { nama: true, avatarUrl: true } } }
      },
      transaksi: true,
      followUp: true
    },
    orderBy: { jadwalSesi: 'desc' }
  });
};

/**
 * Reschedule consultation
 */
const reschedule = async (consultationId, userId, newJadwalSesi) => {
  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(consultationId) }
  });

  if (!konsultasi || konsultasi.userId !== userId) {
    throw ApiError.notFound("Konsultasi tidak ditemukan");
  }


  return prisma.konsultasi.update({
    where: { id: Number(consultationId) },
    data: {
      jadwalSesi: new Date(newJadwalSesi),
      status: 'BOOKED' 
    }
  });
};

/**
 * Cancel consultation
 */
const cancel = async (consultationId, userId, reason) => {
  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(consultationId) }
  });

  if (!konsultasi || konsultasi.userId !== userId) {
    throw ApiError.notFound("Konsultasi tidak ditemukan");
  }

  return prisma.konsultasi.update({
    where: { id: Number(consultationId) },
    data: {
      status: 'CANCELLED',
      catatanKonsultasi: reason ? `Dibatalkan: ${reason}` : 'Dibatalkan oleh pasien'
    }
  });
};

/**
 * Confirm payment — update transaksi to SUCCESS and konsultasi to CONFIRMED
 */
const confirmPayment = async (konsultasiId, userId) => {
  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(konsultasiId) },
    include: { transaksi: true }
  });

  if (!konsultasi || konsultasi.userId !== userId) {
    throw ApiError.notFound("Konsultasi tidak ditemukan");
  }

  return prisma.$transaction(async (tx) => {
    if (konsultasi.transaksiId) {
      await tx.transaksi.update({
        where: { id: konsultasi.transaksiId },
        data: { statusBayar: 'SUCCESS', paidAt: new Date() }
      });
    }
    return tx.konsultasi.update({
      where: { id: Number(konsultasiId) },
      data: { status: 'CONFIRMED' }
    });
  });
};

// ============================================
// NUTRITIONIST-ENDPOINT FUNCTIONS (PPL II)
// ============================================

/**
 * Get consultation user summary — called by nutritionist before session.
 */
const getConsultationUserSummary = async (consultationId, userId) => {
  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(consultationId) },
    include: {
      user: { select: { id: true, nama: true } },
      ahliGizi: { include: { user: { select: { id: true, nama: true } } } },
    },
  });

  if (!konsultasi) throw ApiError.notFound("Konsultasi tidak ditemukan");
  if (konsultasi.ahliGizi.user.id !== userId) throw ApiError.forbidden("Anda tidak memiliki akses ke konsultasi ini");

  const balita = await prisma.balita.findFirst({
    where: { userId: konsultasi.userId },
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { id: true, namaDepan: true, namaAkhir: true, tanggalLahir: true, jenisKelamin: true },
  });

  if (!balita) throw ApiError.notFound("Data anak tidak ditemukan");

  const summary = await childrenService.getGrowthSummary(balita.id, konsultasi.userId);

  return {
    consultation_id: String(konsultasi.id),
    child_name: summary.child_info.name,
    child_info: {
      child_id: summary.child_info.child_id,
      name: summary.child_info.name,
      age_months: summary.child_info.age_months,
      gender: summary.child_info.gender,
      latest_anthropometry: summary.child_info.latest_anthropometry,
    },
    ai_assessment: summary.ai_assessment,
    recent_health_logs: summary.recent_health_logs,
  };
};

/**
 * Create follow-up note — called by nutritionist after session.
 */
const createFollowUp = async (consultationId, userId, body) => {
  const { nutrition_status_evaluation, dietary_recommendations, next_evaluation_date, special_notes } = body;

  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(consultationId) },
    include: {
      ahliGizi: { include: { user: { select: { id: true, nama: true } } } },
    },
  });

  if (!konsultasi) throw ApiError.notFound("Konsultasi tidak ditemukan");
  if (konsultasi.ahliGizi.user.id !== userId) throw ApiError.forbidden("Anda tidak memiliki akses ke konsultasi ini");
  if (konsultasi.status !== "DONE") throw ApiError.badRequest("Follow-up hanya dapat dibuat setelah sesi konsultasi selesai");

  if (!nutrition_status_evaluation || !dietary_recommendations || !next_evaluation_date) {
    throw ApiError.badRequest("Field nutrition_status_evaluation, dietary_recommendations, dan next_evaluation_date wajib diisi");
  }

  const followUp = await prisma.followUp.upsert({
    where: { konsultasiId: Number(consultationId) },
    update: {
      nutritionStatusEvaluation: nutrition_status_evaluation,
      dietaryRecommendations: dietary_recommendations,
      nextEvaluationDate: new Date(next_evaluation_date),
      specialNotes: special_notes || null,
    },
    create: {
      konsultasiId: Number(consultationId),
      nutritionStatusEvaluation: nutrition_status_evaluation,
      dietaryRecommendations: dietary_recommendations,
      nextEvaluationDate: new Date(next_evaluation_date),
      specialNotes: special_notes || null,
    },
  });

  return followUp;
};

/**
 * Get follow-up result — called by user/pasien.
 */
const getUserFollowUp = async (consultationId, userId) => {
  const konsultasi = await prisma.konsultasi.findUnique({
    where: { id: Number(consultationId) },
    include: {
      followUp: true,
      ahliGizi: { select: { gelar: true, user: { select: { nama: true } } } },
    },
  });

  if (!konsultasi) throw ApiError.notFound("Konsultasi tidak ditemukan");
  if (konsultasi.userId !== userId) throw ApiError.forbidden("Anda tidak memiliki akses ke konsultasi ini");

  if (!konsultasi.followUp) {
    throw ApiError.notFound("Belum ada catatan follow-up untuk konsultasi ini");
  }

  const nutritionistName = konsultasi.ahliGizi.gelar
    ? `${konsultasi.ahliGizi.gelar} ${konsultasi.ahliGizi.user.nama}`
    : konsultasi.ahliGizi.user.nama;

  return {
    follow_up_id: String(konsultasi.followUp.id),
    consultation_id: String(konsultasi.id),
    nutritionist_name: nutritionistName,
    consultation_date: konsultasi.jadwalSesi.toISOString().slice(0, 10),
    evaluation_summary: {
      status_label: konsultasi.followUp.nutritionStatusEvaluation,
      recommendations: konsultasi.followUp.dietaryRecommendations,
      next_evaluation_date: konsultasi.followUp.nextEvaluationDate,
      special_notes: konsultasi.followUp.specialNotes,
    },
  };
};

module.exports = {
  getAvailability,
  createBooking,
  getMyConsultations,
  reschedule,
  cancel,
  confirmPayment,
  getConsultationUserSummary,
  createFollowUp,
  getUserFollowUp,
};
