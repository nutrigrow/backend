const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");

/**
 * Get all specialists with filtering and pagination
 * @param {Object} filter - Filter options (search, category)
 * @param {Object} options - Pagination options (page, limit)
 */
const getAllSpecialists = async (filter = {}, options = {}) => {
  const { search, category } = filter;
  const { page = 1, limit = 9 } = options;
  const skip = (page - 1) * limit;

  const where = {
    isAvailable: true,
    user: {
      is: {
        isActive: true,
        deletedAt: null,
      },
    },
  };

  if (category && category !== "Semua") {
    where.spesialisasi = category;
  }

  if (search) {
    where.OR = [
      { user: { is: { nama: { contains: search, mode: "insensitive" } } } },
      { spesialisasi: { contains: search, mode: "insensitive" } },
      { gelar: { contains: search, mode: "insensitive" } },
      { bio: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, specialists] = await Promise.all([
    prisma.profilAhliGizi.count({ where }),
    prisma.profilAhliGizi.findMany({
      where,
      include: {
        user: {
          select: {
            nama: true,
            avatarUrl: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { pengalamanTahun: "desc" }, // Example sorting
    }),
  ]);

  // Add nextAvailable to each specialist
  const specialistsWithAvailability = await Promise.all(
    specialists.map(async (s) => {
      return {
        ...s,
        nextAvailable: await calculateNextAvailable(s.id, s.jadwal),
      };
    })
  );

  return {
    specialists: specialistsWithAvailability,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get specialist by ID
 * @param {number} id - Specialist ID
 */
const getSpecialistById = async (id) => {
  const specialist = await prisma.profilAhliGizi.findUnique({
    where: { id: Number(id) },
    include: {
      user: {
        select: {
          nama: true,
          avatarUrl: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!specialist) {
    throw ApiError.notFound("Spesialis tidak ditemukan");
  }

  if (!specialist.isAvailable || !specialist.user?.isActive || specialist.user?.deletedAt) {
    throw ApiError.notFound("Spesialis tidak ditemukan");
  }

  return {
    ...specialist,
    nextAvailable: await calculateNextAvailable(specialist.id, specialist.jadwal),
  };
};

/**
 * Calculate the next available consultation slot for a specialist
 * @param {number} specialistId 
 * @param {Object} jadwal 
 */
const calculateNextAvailable = async (specialistId, jadwal) => {
  if (!jadwal || !jadwal.hari || !jadwal.waktu || jadwal.hari.length === 0 || jadwal.waktu.length === 0) {
    return null;
  }

  const { hari, waktu } = jadwal;
  
  // Current time
  const now = new Date();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  
  // Check next 7 days
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dayName = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      timeZone: 'Asia/Jakarta'
    }).format(targetDate);

    if (!hari.includes(dayName)) continue;

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

    // Fetch bookings for this day
    const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startOfDay = new Date(midnightUtc - wibOffsetMs); 
    const endOfDay   = new Date(midnightUtc - wibOffsetMs + 24 * 60 * 60 * 1000 - 1);

    const existingBookings = await prisma.konsultasi.findMany({
      where: {
        ahliGiziId: Number(specialistId),
        jadwalSesi: { gte: startOfDay, lte: endOfDay },
        status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] }
      },
      select: { jadwalSesi: true }
    });

    const bookedTimes = existingBookings.map(b => {
      const wibDate = new Date(b.jadwalSesi.getTime() + wibOffsetMs);
      return `${String(wibDate.getUTCHours()).padStart(2, '0')}:${String(wibDate.getUTCMinutes()).padStart(2, '0')}`;
    });

    // Sort time slots to find the earliest one
    const sortedWaktu = [...waktu].sort();

    for (const t of sortedWaktu) {
      // If it's today, check if the time has passed
      if (i === 0) {
        // Create date object for the slot in WIB (+07:00)
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const slotTime = new Date(`${year}-${monthStr}-${dayStr}T${t}:00+07:00`).getTime();
        
        if (slotTime <= now.getTime()) continue;
      }

      if (!bookedTimes.includes(t)) {
        if (i === 0) return `Hari ini, ${t}`;
        if (i === 1) return `Besok, ${t}`;
        return `${dayName}, ${t}`;
      }
    }
  }

  return null;
};

module.exports = {
  getAllSpecialists,
  getSpecialistById,
};
