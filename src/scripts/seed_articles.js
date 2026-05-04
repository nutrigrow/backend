require('dotenv').config();
const prisma = require('../config/database');

// ─── Rich Content Bodies ───────────────────────────────────────────────────────

const CONTENT_MPASI = {
  intro: 'Enam bulan adalah tonggak penting dalam perjalanan nutrisi si kecil. Di usia inilah, ASI atau susu formula tidak lagi cukup untuk memenuhi seluruh kebutuhan energi dan mikronutrien yang semakin meningkat seiring tumbuh kembangnya. MPASI—Makanan Pendamping ASI—hadir sebagai jembatan nutrisi yang memperkenalkan dunia rasa dan tekstur kepada bayi Anda, sambil tetap mempertahankan ASI sebagai sumber nutrisi utama.',
  sections: [
    { type: 'heading2', text: 'Tanda-tanda Bayi Siap MPASI' },
    { type: 'paragraph', text: 'Sebelum memulai MPASI, penting untuk memastikan bayi benar-benar siap secara fisik dan neurologis. Memulai terlalu dini dapat meningkatkan risiko alergi dan masalah pencernaan, sementara memulai terlalu lambat dapat menyebabkan defisiensi nutrisi. WHO merekomendasikan pemberian MPASI dimulai tepat di usia 6 bulan, bersamaan dengan tetap melanjutkan ASI hingga usia 2 tahun atau lebih.' },
    { type: 'list', items: [
      { label: 'Duduk Tegak', text: 'Bayi dapat duduk tegak dengan sedikit bantuan dan mampu menahan kepala dengan stabil' },
      { label: 'Hilangnya Refleks Ekstrusi', text: 'Bayi tidak lagi mendorong keluar benda yang masuk ke mulutnya secara otomatis' },
      { label: 'Ketertarikan pada Makanan', text: 'Bayi menunjukkan minat yang besar dengan meraih makanan di piring Anda' },
      { label: 'Koordinasi Mulut Berkembang', text: 'Bayi dapat menggerakkan makanan dari depan ke belakang mulutnya dengan lancar' },
    ]},
    { type: 'heading2', text: 'Memilih Makanan Pertama yang Tepat' },
    { type: 'paragraph', text: 'Pilih bahan makanan dengan risiko alergi rendah dan kaya nutrisi untuk memulai. Puree sayuran seperti labu kuning, ubi jalar, dan wortel adalah pilihan ideal karena rasanya yang manis alami dan mudah dicerna. Sereal beras merah yang difortifikasi zat besi juga sangat direkomendasikan karena kebutuhan zat besi bayi meningkat signifikan di usia ini—ASI saja tidak lagi cukup untuk memenuhinya.' },
    { type: 'images', items: [
      { src: 'https://images.unsplash.com/photo-1599908122606-c3bc86f8aac5?w=800&q=80', alt: 'Sayuran dan buah segar bergizi' },
      { src: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=800&q=80', alt: 'Makanan MPASI sehat untuk bayi' },
    ]},
    { type: 'heading2', text: 'Tekstur dan Porsi yang Tepat di Setiap Tahap' },
    { type: 'paragraph', text: 'Mulailah dengan tekstur yang sangat halus—hampir cair—kemudian secara bertahap tingkatkan kekentalan seiring bertambahnya usia dan kemampuan menelan bayi. Pada awalnya, cukup berikan 1-2 sendok teh per sesi makan, 1-2 kali sehari. Ingat, tujuan utama MPASI di fase awal ini adalah memperkenalkan rasa dan pengalaman makan, bukan untuk menggantikan kalori dari ASI.' },
    { type: 'blockquote', text: '"Setiap bayi adalah unik. Beberapa mungkin langsung antusias mencoba rasa baru, sementara yang lain membutuhkan waktu dan kesabaran untuk beradaptasi. Konsistensi dan kreativitas Anda sebagai orang tua adalah kunci keberhasilan MPASI."' },
    { type: 'heading2', text: 'Makanan yang Perlu Dihindari Sebelum Usia 1 Tahun' },
    { type: 'paragraph', text: 'Keamanan adalah prioritas utama dalam setiap langkah MPASI. Ada beberapa bahan makanan yang sebaiknya ditunda hingga bayi mencapai usia tertentu untuk menghindari risiko kesehatan yang serius.' },
    { type: 'list', items: [
      { label: 'Madu', text: 'Hindari hingga usia 1 tahun karena risiko botulisme akibat spora Clostridium' },
      { label: 'Garam & Gula Tambahan', text: 'Ginjal dan metabolisme bayi belum siap memproses mineral berlebih' },
      { label: 'Susu Sapi Murni', text: 'Dapat menggantikan ASI setelah usia 1 tahun, tidak sebelumnya' },
      { label: 'Makanan Keras Bulat', text: 'Anggur utuh, kacang utuh, dan potongan besar meningkatkan risiko tersedak' },
    ]},
  ],
};

const CONTENT_KEHAMILAN = {
  intro: 'Trimester pertama kehamilan adalah periode paling kritis dalam pembentukan organ janin. Selama 12 minggu pertama, hampir seluruh struktur dasar tubuh si kecil—dari sistem saraf hingga jantung—mulai terbentuk dan berkembang dengan pesat. Pilihan nutrisi Anda di masa ini memiliki dampak jangka panjang yang tidak bisa diabaikan pada kesehatan dan kecerdasan buah hati.',
  sections: [
    { type: 'heading2', text: 'Asam Folat: Pahlawan Tersembunyi Kehamilan' },
    { type: 'paragraph', text: 'Asam folat adalah nutrisi terpenting di trimester pertama. Vitamin B ini berperan krusial dalam pembentukan tabung neural janin yang kelak menjadi otak dan tulang belakang. Kekurangan asam folat meningkatkan risiko cacat neural tube seperti spina bifida dan anensefali hingga 70%. Idealnya, suplementasi asam folat dimulai sejak 3 bulan sebelum kehamilan direncanakan.' },
    { type: 'list', items: [
      { label: 'Sayuran Hijau Gelap', text: 'Bayam, brokoli, dan kale adalah sumber folat alami terbaik yang tersedia' },
      { label: 'Kacang-kacangan', text: 'Kacang hitam, lentil, dan edamame kaya folat sekaligus protein nabati berkualitas' },
      { label: 'Jeruk dan Citrus', text: 'Vitamin C membantu penyerapan folat dan memperkuat sistem imun ibu' },
      { label: 'Suplemen Prenatal', text: 'Dokter umumnya merekomendasikan 400–800 mcg asam folat sintetis per hari' },
    ]},
    { type: 'heading2', text: 'Mengatasi Mual Kehamilan dengan Strategi Makan Cerdas' },
    { type: 'paragraph', text: 'Mual pagi (morning sickness) dialami oleh hingga 80% ibu hamil di trimester pertama—dan bisa terjadi kapan saja sepanjang hari. Alih-alih menyerah pada rasa tidak nyaman ini, ada strategi makan yang dapat membantu Anda tetap mendapatkan nutrisi yang diperlukan untuk janin dan kesehatan Anda sendiri.' },
    { type: 'images', items: [
      { src: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80', alt: 'Makanan sehat bergizi untuk ibu hamil' },
      { src: 'https://images.unsplash.com/photo-1493894473891-10fc1e5dbd22?w=800&q=80', alt: 'Ibu hamil menjaga kesehatan dan kebugaran' },
    ]},
    { type: 'heading2', text: 'Kebutuhan Zat Besi yang Meningkat Signifikan' },
    { type: 'paragraph', text: 'Volume darah dalam tubuh meningkat hingga 50% selama kehamilan, sehingga kebutuhan zat besi pun melonjak drastis. Anemia defisiensi besi adalah kondisi paling umum pada ibu hamil dan dapat berdampak pada kecerdasan kognitif serta perkembangan sistem imun bayi jika tidak ditangani dengan tepat sejak awal.' },
    { type: 'blockquote', text: '"Nutrisi yang baik selama kehamilan bukan hanya tentang apa yang Anda makan hari ini—ini adalah investasi kesehatan jangka panjang yang akan dirasakan anak Anda selama bertahun-tahun ke depan."' },
    { type: 'heading2', text: 'Hidrasi dan Suplemen yang Tepat untuk Ibu Hamil' },
    { type: 'paragraph', text: 'Kebutuhan cairan meningkat signifikan selama kehamilan untuk mendukung peningkatan volume darah dan pembentukan cairan amnion. Pastikan minum setidaknya 8-10 gelas air per hari, dan lebih banyak jika Anda aktif berolahraga atau tinggal di daerah beriklim panas.' },
    { type: 'list', items: [
      { label: 'Air Putih', text: 'Minimal 2 liter per hari untuk mendukung sirkulasi darah dan pembentukan plasenta' },
      { label: 'Susu & Produk Susu', text: 'Sumber kalsium dan vitamin D esensial untuk pembentukan tulang dan gigi janin' },
      { label: 'Suplemen Prenatal', text: 'Konsultasikan dengan dokter kandungan untuk formula yang sesuai kondisi Anda' },
      { label: 'Batasi Kafein', text: 'Maksimal 200 mg kafein per hari—setara satu cangkir kopi kecil' },
    ]},
  ],
};

const CONTENT_MENYUSUI = {
  intro: 'ASI adalah makanan paling sempurna untuk bayi baru lahir—mengandung semua nutrisi yang dibutuhkan dalam proporsi yang tepat, beserta antibodi, hormon pertumbuhan, dan faktor imunologis yang tidak dapat direplikasi oleh produk apapun di dunia. Namun, untuk memproduksi ASI yang berkualitas tinggi secara konsisten, ibu menyusui membutuhkan perhatian khusus dan terencana pada asupan gizinya setiap hari.',
  sections: [
    { type: 'heading2', text: 'Kalori Ekstra untuk Mendukung Produksi ASI' },
    { type: 'paragraph', text: 'Menyusui membutuhkan sekitar 300-500 kalori ekstra per hari di atas kebutuhan dasar Anda. Jangan tergoda untuk melakukan diet ketat di masa ini—tubuh Anda membutuhkan energi yang cukup untuk memproduksi ASI yang kaya nutrisi bagi si kecil sekaligus menjaga kesehatan dan stamina Anda sebagai ibu.' },
    { type: 'list', items: [
      { label: 'Protein Berkualitas Tinggi', text: 'Daging tanpa lemak, telur, dan legum mendukung kualitas dan kuantitas produksi ASI' },
      { label: 'Lemak Sehat (DHA)', text: 'Ikan salmon, alpukat, dan minyak zaitun untuk kandungan DHA optimal dalam ASI' },
      { label: 'Karbohidrat Kompleks', text: 'Oat, beras merah, dan ubi memberikan energi berkelanjutan sepanjang hari' },
      { label: 'Kalsium & Vitamin D', text: 'Susu, yogurt, dan paparan sinar matahari untuk kesehatan tulang ibu jangka panjang' },
    ]},
    { type: 'heading2', text: 'Galaktagog: Makanan Peningkat Produksi ASI' },
    { type: 'paragraph', text: 'Beberapa makanan secara tradisional dan ilmiah terbukti membantu meningkatkan produksi ASI. Meski tidak ada "makanan ajaib" tunggal, konsumsi galaktagog yang dikombinasikan dengan frekuensi menyusui yang cukup dapat memberikan perbedaan yang signifikan dan terukur dalam volume ASI yang diproduksi.' },
    { type: 'images', items: [
      { src: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80', alt: 'Ibu menyusui dengan penuh kasih' },
      { src: 'https://images.unsplash.com/photo-1588428894220-ae6af96e8c2d?w=800&q=80', alt: 'Makanan bergizi kaya omega-3 untuk ibu menyusui' },
    ]},
    { type: 'heading2', text: 'Hidrasi: Fondasi Produksi ASI yang Optimal' },
    { type: 'paragraph', text: 'ASI mengandung sekitar 87% air. Ibu menyusui kehilangan hingga 700 ml cairan ekstra per hari melalui produksi ASI saja. Minum segelas air setiap kali menyusui adalah kebiasaan sederhana namun sangat efektif untuk menjaga hidrasi dan produksi ASI yang optimal.' },
    { type: 'blockquote', text: '"Menyusui adalah salah satu investasi kesehatan terbesar yang dapat Anda berikan kepada buah hati Anda. Nutrisi yang baik bukan hanya mendukung produksi ASI—ini juga menjaga energi, kesehatan mental, dan kebahagiaan Anda sebagai ibu."' },
    { type: 'heading2', text: 'Makanan yang Perlu Diwaspadai Saat Menyusui' },
    { type: 'paragraph', text: 'Meski sebagian besar makanan aman dikonsumsi saat menyusui, beberapa bahan dapat mempengaruhi rasa dan aroma ASI, atau menyebabkan ketidaknyamanan pada bayi yang sensitif. Perhatikan respons bayi dan catat makanan yang tampak mengganggu kenyamanannya.' },
    { type: 'list', items: [
      { label: 'Kafein', text: 'Batasi hingga 200mg/hari; kafein berlebih dapat mengganggu tidur bayi sensitif' },
      { label: 'Alkohol', text: 'Hindari sepenuhnya atau tunggu 2-3 jam setelah konsumsi sebelum menyusui' },
      { label: 'Alergen Umum', text: 'Monitor respons bayi terhadap susu sapi, kedelai, dan produk yang mengandung gluten' },
      { label: 'Makanan Pedas & Berbau Kuat', text: 'Dapat mengubah rasa ASI; amati apakah bayi tampak menolak atau rewel' },
    ]},
  ],
};

const CONTENT_TUMBUH_KEMBANG = {
  intro: 'Tiga tahun pertama kehidupan seorang anak adalah periode perkembangan yang paling pesat dan paling menentukan dalam sejarah hidupnya. Dalam rentang waktu yang singkat ini, otak bayi membentuk lebih dari satu juta koneksi saraf baru setiap detiknya—membangun fondasi untuk kemampuan belajar, regulasi emosi, dan kesehatan sepanjang hayat. Investasi pada stimulasi dan nutrisi di periode ini memberikan return yang tak ternilai.',
  sections: [
    { type: 'heading2', text: 'Milestone Motorik: Perjalanan dari Berbaring hingga Berlari' },
    { type: 'paragraph', text: 'Perkembangan motorik mengikuti pola yang dapat diprediksi: dari kepala ke kaki (cephalocaudal), dan dari pusat tubuh ke ekstremitas (proximodistal). Memahami tahapan perkembangan ini membantu orang tua memberikan stimulasi yang tepat pada waktu yang tepat, serta mendeteksi lebih dini jika ada keterlambatan yang perlu ditangani.' },
    { type: 'list', items: [
      { label: '0–3 Bulan', text: 'Mengontrol kepala, refleks menggenggam kuat, respons aktif terhadap suara dan wajah' },
      { label: '4–6 Bulan', text: 'Berguling, duduk dengan bantuan, meraih dan menggenggam benda dengan kedua tangan' },
      { label: '7–9 Bulan', text: 'Duduk mandiri, mulai merangkak, memindahkan benda dengan terampil antar tangan' },
      { label: '10–12 Bulan', text: 'Berdiri berpegangan, melangkah pertama, mengucapkan kata bermakna pertama' },
    ]},
    { type: 'heading2', text: 'Nutrisi Kunci yang Mendukung Perkembangan Otak Optimal' },
    { type: 'paragraph', text: 'Tidak semua nutrisi memberikan dampak yang sama terhadap perkembangan otak. Beberapa mikronutrien memiliki peran yang sangat spesifik dan kritikal dalam proses pembentukan jaringan saraf, mielinisasi, dan sirkuit kognitif. Kekurangan nutrisi-nutrisi ini di 1000 hari pertama kehidupan dapat meninggalkan dampak permanen yang sulit diperbaiki di kemudian hari.' },
    { type: 'images', items: [
      { src: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&q=80', alt: 'Anak balita aktif bermain dan bereksplorasi' },
      { src: 'https://images.unsplash.com/photo-1643539541155-73134fdaa82c?w=800&q=80', alt: 'Anak kecil menikmati makanan sehat bergizi' },
    ]},
    { type: 'heading2', text: 'Stimulasi Kognitif dan Perkembangan Bahasa' },
    { type: 'paragraph', text: 'Berbicara, membaca, dan bernyanyi untuk bayi bukan sekadar aktivitas yang menyenangkan—ini adalah investasi nyata dalam arsitektur otak anak. Setiap interaksi verbal menciptakan koneksi saraf baru di korteks prefrontal, area yang bertanggung jawab atas bahasa, memori kerja, dan kemampuan pemecahan masalah sepanjang hidup.' },
    { type: 'blockquote', text: '"Otak anak tidak hanya tumbuh—ia dibentuk oleh setiap pengalaman, setiap pelukan hangat, setiap kata yang diucapkan dengan penuh kasih. Investasi terbaik yang dapat Anda berikan adalah waktu dan perhatian berkualitas setiap harinya."' },
    { type: 'heading2', text: 'Tanda Peringatan Dini yang Perlu Diwaspadai' },
    { type: 'paragraph', text: 'Setiap anak berkembang dengan ritme uniknya sendiri. Variasi dalam usia pencapaian milestone adalah hal yang normal. Namun, ada tanda-tanda tertentu yang sebaiknya segera dikonsultasikan dengan dokter spesialis anak atau ahli tumbuh kembang untuk evaluasi lebih lanjut.' },
    { type: 'list', items: [
      { label: 'Tidak Ada Kontak Mata', text: 'Bayi usia 2+ bulan yang tidak merespons wajah atau tidak tersenyum balas' },
      { label: 'Keterlambatan Motorik', text: 'Tidak dapat duduk mandiri di usia 9 bulan atau berdiri berpegangan di usia 12 bulan' },
      { label: 'Absennya Babbling', text: 'Tidak ada vokalisasi bermakna di usia 6 bulan atau kata pertama di usia 12 bulan' },
      { label: 'Regresi Kemampuan', text: 'Hilangnya kemampuan yang sudah dikuasai sebelumnya selalu memerlukan evaluasi segera' },
    ]},
  ],
};

// ─── Article Data ─────────────────────────────────────────────────────────────

const ARTICLES = [
  {
    judul: 'Panduan Lengkap MPASI Pertama untuk Bayi 6 Bulan',
    kategori: 'MPASI',
    gambarUrl: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=800&q=80',
    penulis: 'Tim NutriGrow',
    publishedAt: new Date('2025-01-15'),
    konten: CONTENT_MPASI,
  },
  {
    judul: 'Nutrisi Penting untuk Ibu Hamil Trimester Pertama',
    kategori: 'KEHAMILAN',
    gambarUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
    penulis: 'Dr. Sari Dewi',
    publishedAt: new Date('2025-01-10'),
    konten: CONTENT_KEHAMILAN,
  },
  {
    judul: 'Tips Meningkatkan Produksi ASI Secara Alami',
    kategori: 'MENYUSUI',
    gambarUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80',
    penulis: 'Bidan Rahma',
    publishedAt: new Date('2025-01-08'),
    konten: CONTENT_MENYUSUI,
  },
  {
    judul: 'Milestone Perkembangan Anak Usia 1-3 Tahun',
    kategori: 'GIZI',
    gambarUrl: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&q=80',
    penulis: 'Dr. Andi Pratama',
    publishedAt: new Date('2025-01-05'),
    konten: CONTENT_TUMBUH_KEMBANG,
  },
  {
    judul: 'Resep MPASI Bergizi untuk Bayi 8-10 Bulan',
    kategori: 'MPASI',
    gambarUrl: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=800&q=80',
    penulis: 'Chef Nutrisi NutriGrow',
    publishedAt: new Date('2025-01-02'),
    konten: CONTENT_MPASI,
  },
  {
    judul: 'Mengatasi Mual dan Muntah saat Hamil',
    kategori: 'KEHAMILAN',
    gambarUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80',
    penulis: 'Dr. Lina Kusuma',
    publishedAt: new Date('2024-12-29'),
    konten: CONTENT_KEHAMILAN,
  },
  {
    judul: 'Posisi Menyusui yang Nyaman dan Efektif',
    kategori: 'MENYUSUI',
    gambarUrl: 'https://images.unsplash.com/photo-1519689373023-dd07c7988603?w=800&q=80',
    penulis: 'Konselor Laktasi NutriGrow',
    publishedAt: new Date('2024-12-26'),
    konten: CONTENT_MENYUSUI,
  },
  {
    judul: 'Stimulasi Motorik Halus untuk Balita',
    kategori: 'GIZI',
    gambarUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80',
    penulis: 'Terapis Anak NutriGrow',
    publishedAt: new Date('2024-12-22'),
    konten: CONTENT_TUMBUH_KEMBANG,
  },
  {
    judul: 'Menu MPASI Anti GTM (Gerakan Tutup Mulut)',
    kategori: 'MPASI',
    gambarUrl: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&q=80',
    penulis: 'Ahli Gizi NutriGrow',
    publishedAt: new Date('2024-12-18'),
    konten: CONTENT_MPASI,
  },
  {
    judul: 'Olahraga Aman untuk Ibu Hamil',
    kategori: 'KEHAMILAN',
    gambarUrl: 'https://images.unsplash.com/photo-1493894473891-10fc1e5dbd22?w=800&q=80',
    penulis: 'Instruktur Prenatal NutriGrow',
    publishedAt: new Date('2024-12-15'),
    konten: CONTENT_KEHAMILAN,
  },
  {
    judul: 'Menyusui dan Bekerja: Tips Menyimpan ASI Perah',
    kategori: 'MENYUSUI',
    gambarUrl: 'https://images.unsplash.com/photo-1548174985-512f0e7896a1?w=800&q=80',
    penulis: 'Tim NutriGrow',
    publishedAt: new Date('2024-12-12'),
    konten: CONTENT_MENYUSUI,
  },
  {
    judul: 'Perkembangan Bahasa Anak dan Cara Menstimulasinya',
    kategori: 'GIZI',
    gambarUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784422?w=800&q=80',
    penulis: 'Psikolog Anak NutriGrow',
    publishedAt: new Date('2024-12-08'),
    konten: CONTENT_TUMBUH_KEMBANG,
  },
];

// ─── Seed Function ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding articles...');

  for (const article of ARTICLES) {
    await prisma.artikelEdukasi.create({
      data: {
        judul:       article.judul,
        kategori:    article.kategori,
        gambarUrl:   article.gambarUrl,
        penulis:     article.penulis,
        publishedAt: article.publishedAt,
        isPublished: true,
        konten:      JSON.stringify(article.konten),
      },
    });
    console.log(`  ✓ ${article.judul}`);
  }

  console.log(`\nSeeding finished — ${ARTICLES.length} articles created.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
