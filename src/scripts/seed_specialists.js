require('dotenv').config();
const prisma = require("../config/database");
const bcrypt = require("bcryptjs");

const specialists = [
  {
    nama: 'Dr. Sarah Jenkins',
    gelar: 'Ph.D., RDN',
    spesialisasi: 'Spesialis Anak',
    pengalamanTahun: 12,
    harga: { videoCall: 85000, chat: 45000 },
    foto: 'https://images.unsplash.com/photo-1675270690434-aa99f4871e8a?w=400&q=80',
    pendidikan: [
      'Ph.D. Nutritional Sciences, Stanford University',
      'Board Certified Holistic Nutritionist',
    ],
    registrasiMedis: 'STR: 1234567890',
    bio: 'Pendekatan saya terhadap nutrisi sangat berakar pada keyakinan bahwa makanan adalah fondasi ekologi keseluruhan kita. Saya tidak percaya pada diet restriktif satu ukuran untuk semua. Sebaliknya, saya fokus pada pemahaman lanskap fisiologis Anda dan menciptakan strategi berkelanjutan yang terintegrasi dengan kehidupan Anda.',
    bidangKeahlian: [
      'Irritable Bowel Syndrome (IBS)',
      'Autoimmune Protocol (AIP)',
      'Hormonal Imbalance',
      'Gut Health',
    ],
    jadwal: {
      hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
      waktu: ['09:00', '10:00', '11:30', '13:00', '14:30', '16:00'],
    },
  },
  {
    nama: 'Marcus Thorne',
    gelar: 'M.S., CSSD',
    spesialisasi: 'Nutrisi Olahraga',
    pengalamanTahun: 8,
    harga: { videoCall: 95000, chat: 50000 },
    foto: 'https://images.unsplash.com/photo-1756699279298-c89cdef354ab?w=400&q=80',
    pendidikan: [
      'M.S. Exercise Physiology, UCLA',
      'Certified Sports Dietitian (CSSD)',
    ],
    registrasiMedis: 'STR: 9876543210',
    bio: 'Mantan pelatih atletik yang beralih menjadi ahli nutrisi olahraga. Berspesialisasi dalam pemberian nutrisi untuk atlet berprestasi tinggi, membantu mereka mencapai puncak performa melalui strategi gizi yang tepat.',
    bidangKeahlian: [
      'Performance Nutrition',
      'Recovery Optimization',
      'Body Composition',
      'Endurance Sports',
    ],
    jadwal: {
      hari: ['Senin', 'Rabu', 'Jumat', 'Sabtu'],
      waktu: ['07:00', '09:00', '11:00', '14:00', '16:00'],
    },
  },
  {
    nama: 'Elena Rodriguez',
    gelar: 'RDN, LD',
    spesialisasi: 'Spesialis Anak',
    pengalamanTahun: 10,
    harga: { videoCall: 110000, chat: 60000 },
    foto: 'https://images.unsplash.com/photo-1612944095914-33fd0a85fcfc?w=400&q=80',
    pendidikan: [
      'M.S. Pediatric Nutrition, Harvard University',
      'Registered Dietitian Nutritionist (RDN)',
    ],
    registrasiMedis: 'STR: 1122334455',
    bio: 'Elena bekerja dengan keluarga untuk mengatasi picky eating, alergi makanan, dan masalah pertumbuhan anak. Ia menciptakan rencana makan yang menyenangkan dan bergizi yang disukai anak-anak.',
    bidangKeahlian: [
      'Childhood Nutrition & Allergies',
      'Picky Eating Solutions',
      'Growth Development',
      'MPASI Introduction',
    ],
    jadwal: {
      hari: ['Selasa', 'Kamis', 'Sabtu'],
      waktu: ['09:00', '10:30', '13:00', '15:00'],
    },
  },
  {
    nama: 'Dr. Elena Rostova',
    gelar: 'M.D., Ph.D.',
    spesialisasi: 'Kehamilan',
    pengalamanTahun: 15,
    harga: { videoCall: 120000, chat: 65000 },
    foto: 'https://images.unsplash.com/photo-1673865641073-4479f93a7776?w=400&q=80',
    pendidikan: ['M.D. Obstetric Nutrition, Moscow State Medical', 'Ph.D. Maternal-Fetal Nutrition, Cambridge University'],
    registrasiMedis: 'STR: 5544332211',
    bio: 'Dokter klinis senior yang berspesialisasi dalam nutrisi ibu hamil dan menyusui dengan pengalaman 15 tahun.',
    bidangKeahlian: ['Maternal Nutrition', 'Prenatal Care', 'Gestational Diabetes', 'Fetal Development Nutrition'],
    jadwal: {
      hari: ['Senin', 'Selasa', 'Rabu', 'Kamis'],
      waktu: ['08:00', '10:00', '13:00', '15:00'],
    },
  },
  {
    nama: 'Dr. Michael Chen',
    gelar: 'M.D., IBCLC',
    spesialisasi: 'Ibu Menyusui',
    pengalamanTahun: 9,
    harga: { videoCall: 90000, chat: 55000 },
    foto: 'https://images.unsplash.com/photo-1758691463605-f4a3a92d6d37?w=400&q=80',
    pendidikan: ['M.D. Pediatrics, Johns Hopkins University', 'International Board Certified Lactation Consultant (IBCLC)'],
    registrasiMedis: 'STR: 6677889900',
    bio: 'Spesialis laktasi dan nutrisi pasca melahirkan yang membantu ibu menyusui dengan sukses.',
    bidangKeahlian: ['Lactation Support', 'Postpartum Nutrition', 'Breastfeeding Challenges', 'Milk Supply Issues'],
    jadwal: {
      hari: ['Senin', 'Rabu', 'Jumat'],
      waktu: ['10:00', '13:00', '14:30', '16:00'],
    },
  },
  {
    nama: 'Dr. Sinta Permata',
    gelar: 'Sp.A., M.Kes',
    spesialisasi: 'MPASI',
    pengalamanTahun: 6,
    harga: { videoCall: 80000, chat: 40000 },
    foto: 'https://images.unsplash.com/photo-1536064479547-7ee40b74b807?w=400&q=80',
    pendidikan: ['Dokter Spesialis Anak, Universitas Indonesia', 'M.Kes Nutrisi Klinik, FKUI Jakarta'],
    registrasiMedis: 'STR: 3344556677',
    bio: 'Spesialis MPASI yang membantu orang tua dalam memperkenalkan makanan padat kepada bayi dengan cara yang aman.',
    bidangKeahlian: ['Baby Led Weaning (BLW)', 'MPASI Homemade', 'Alergi Makanan Bayi', 'Jadwal MPASI Terstruktur'],
    jadwal: {
      hari: ['Selasa', 'Kamis', 'Sabtu'],
      waktu: ['09:00', '11:00', '13:30'],
    },
  },
  {
    nama: 'Dr. Fatimah Azzahra',
    gelar: 'Sp.OG., M.Gizi',
    spesialisasi: 'Kehamilan',
    pengalamanTahun: 7,
    harga: { videoCall: 85000, chat: 45000 },
    foto: 'https://images.unsplash.com/photo-1737792837727-fd46ff71acf2?w=400&q=80',
    pendidikan: ['Dokter Spesialis Obstetri & Ginekologi, UNAIR', 'M.Gizi Nutrisi Maternal, FK UNAIR Surabaya'],
    registrasiMedis: 'STR: 7788990011',
    bio: 'Dokter kandungan yang juga ahli gizi maternal, membantu ibu hamil mendapatkan nutrisi optimal.',
    bidangKeahlian: ['Nutrisi Per Trimester', 'Kontrol Berat Badan Hamil', 'Diabetes Gestasional', 'Anemia Kehamilan'],
    jadwal: {
      hari: ['Senin', 'Rabu', 'Jumat'],
      waktu: ['08:00', '10:00', '14:00'],
    },
  },
  {
    nama: 'Dr. Andi Wijaya',
    gelar: 'M.Sc., RD',
    spesialisasi: 'Tumbuh Kembang',
    pengalamanTahun: 11,
    harga: { videoCall: 100000, chat: 55000 },
    foto: 'https://images.unsplash.com/photo-1746813628081-0c8c1611aace?w=400&q=80',
    pendidikan: ['M.Sc. Child Nutrition, Wageningen University', 'Registered Dietitian (RD), Indonesia'],
    registrasiMedis: 'STR: 8899001122',
    bio: 'Ahli nutrisi tumbuh kembang yang berdedikasi membantu anak mencapai potensi optimal melalui pola makan seimbang.',
    bidangKeahlian: ['Pencegahan Stunting', 'Nutrisi Balita', 'Tumbuh Kembang Optimal', 'Intervensi Malnutrisi'],
    jadwal: {
      hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
      waktu: ['08:30', '10:00', '13:00', '15:00'],
    },
  },
  {
    nama: 'Dr. Linda Hartono',
    gelar: 'Ph.D., RDN',
    spesialisasi: 'Ibu Menyusui',
    pengalamanTahun: 13,
    harga: { videoCall: 115000, chat: 60000 },
    foto: 'https://images.unsplash.com/photo-1675270882554-ab6817fb44f3?w=400&q=80',
    pendidikan: ['Ph.D. Nutritional Biochemistry, NUS Singapore', 'Certified Lactation Educator Counselor (CLEC)'],
    registrasiMedis: 'STR: 9900112233',
    bio: 'Pakar nutrisi menyusui dengan pengalaman 13 tahun membantu ibu mendapatkan produksi ASI optimal.',
    bidangKeahlian: ['ASI Eksklusif & Optimasi', 'Nutrisi Ibu Menyusui', 'Produksi & Kualitas ASI', 'Weaning Strategies'],
    jadwal: {
      hari: ['Selasa', 'Kamis'],
      waktu: ['09:00', '11:00', '14:00', '16:00'],
    },
  },
];

async function seed() {
  console.log("Seeding specialists...");
  const passwordHash = await bcrypt.hash("specialist123", 10);

  for (const s of specialists) {
    const email = s.nama.toLowerCase().replace(/\s+/g, '.') + "@nutrigrow.com";
    
    // Create User
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        nama: s.nama,
        email,
        passwordHash,
        role: 'AHLI_GIZI',
        avatarUrl: s.foto,
      },
    });

    // Create ProfilAhliGizi
    await prisma.profilAhliGizi.upsert({
      where: { userId: user.id },
      update: {
        gelar: s.gelar,
        spesialisasi: s.spesialisasi,
        pengalamanTahun: s.pengalamanTahun,
        pendidikan: s.pendidikan,
        registrasiMedis: s.registrasiMedis,
        bidangKeahlian: s.bidangKeahlian,
        jadwal: s.jadwal,
        biayaVideoCall: s.harga.videoCall,
        biayaChat: s.harga.chat,
        bio: s.bio,
        fotoUrl: s.foto,
      },
      create: {
        userId: user.id,
        gelar: s.gelar,
        sertifikasi: 'Certified RDN',
        spesialisasi: s.spesialisasi,
        pengalamanTahun: s.pengalamanTahun,
        pendidikan: s.pendidikan,
        registrasiMedis: s.registrasiMedis,
        bidangKeahlian: s.bidangKeahlian,
        jadwal: s.jadwal,
        biayaVideoCall: s.harga.videoCall,
        biayaChat: s.harga.chat,
        bio: s.bio,
        fotoUrl: s.foto,
      },
    });
    
    console.log(`Seeded specialist: ${s.nama}`);
  }

  console.log("Seeding finished.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
