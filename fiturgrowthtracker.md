# TASK INSTRUCTIONS: Growth Tracker & Health Log Backend Implementation

## 1. Context & Tech Stack
- **Project:** Growth Tracker & Health Log
- **Core Features:** Manajemen profil anak (Balita), pencatatan historis tinggi dan berat badan, komputasi BMI, dan pemetaan persentil pertumbuhan berdasarkan standar WHO.
- **Server Constraint:** Perhitungan BMI dan komparasi persentil (percentile) harus dilakukan secara efisien. Usahakan melakukan kalkulasi umur (dalam hari), perhitungan BMI, dan pencocokan persentil di level *service/controller* backend agar tidak membebani frontend saat menarik data historis yang panjang.

## 2. Prisma Schema Updates
Agent, please update the existing `schema.prisma` with the following modifications to match the new Growth Tracker requirements, then run the appropriate migration command (`npx prisma migrate dev --name update_growth_tracker_features`).

```prisma
// 1. Update EXISTING Balita Model
// Menyesuaikan kolom nama untuk dipecah menjadi namaDepan dan namaAkhir
model Balita {
  id           Int          @id @default(autoincrement())
  userId       Int          @map("user_id")
  namaDepan    String       @map("nama_depan") // Menggantikan namaAnak
  namaAkhir    String?      @map("nama_akhir") // Kolom baru
  tanggalLahir DateTime     @map("tanggal_lahir") @db.Date
  jenisKelamin JenisKelamin @map("jenis_kelamin")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  rekamPertumbuhan RekamPertumbuhan[]

  @@index([userId])
  @@map("balita")
}

// 2. Note on EXISTING Reference Models (Tidak perlu diubah, cukup di-query)
// - model RekamPertumbuhan (sudah memiliki tinggiBadan, beratBadan, tanggalCatat)
// - model PertumbuhanLakiLaki & PertumbuhanPerempuan (sudah memiliki p01 hingga p999)
// - model bmi (sudah memiliki day, bmi_girl, bmi_boy)

3. API Endpoints to Implement
Implement the following RESTful API endpoints. Assume authentication middleware is present and attaches req.user.id. Validasi otorisasi: pastikan balitaId yang diakses benar-benar milik req.user.id.

A. Child Profile Management (Protected)
GET /api/children

Logic: Fetch semua data Balita milik req.user.id.

Select: id, namaDepan, namaAkhir, tanggalLahir, jenisKelamin.

POST /api/children

Body: { namaDepan: string, namaAkhir?: string, tanggalLahir: Date, jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" }

Logic: Buat profil Balita baru yang direlasikan ke req.user.id.

GET /api/children/:id

Logic: Fetch profil detail Balita berdasarkan ID. Return 404 jika tidak ditemukan atau jika bukan milik user yang sedang login.

PUT /api/children/:id

Body: { namaDepan, namaAkhir, tanggalLahir, jenisKelamin }

Logic: Update profil Balita.

B. Growth Tracker Input (Bagian 1)
GET /api/children/:id/name

Logic: Fetch namaDepan dan namaAkhir dari anak tersebut (digunakan frontend untuk menampilkan judul di halaman input tracker).

POST /api/children/:id/growth

Body: { tinggiBadan: number, beratBadan: number, tanggalCatat: Date }

Logic: * Pastikan Balita dengan ID tersebut valid.

Buat record baru di RekamPertumbuhan (tinggi dalam float cm, berat dalam float kg).

C. Growth Tracker Dashboard (Bagian 2)
GET /api/children/:id/growth/latest

Logic: * Fetch 1 data terakhir dari RekamPertumbuhan berdasarkan balitaId, diurutkan dengan orderBy: { tanggalCatat: 'desc' }.

Jika data tidak ada: Return response khusus, misal: { message: "Belum ada data pertumbuhan anak. Silakan input data pertama!", data: null }.

Jika ada: Return tinggiBadan (Current height), beratBadan (Current weight), dan tanggalCatat (Last updated).

D. BMI Chart vs WHO (Bagian 3)
GET /api/children/:id/growth/bmi-chart

Logic:

Fetch data tanggalLahir dan jenisKelamin dari Balita.

Fetch semua data historis RekamPertumbuhan milik anak tersebut (orderBy: { tanggalCatat: 'asc' }).

Lakukan iterasi per baris historis:

Hitung Usia Anak (dalam hari): tanggalCatat - tanggalLahir.

Hitung BMI Anak: beratBadan / (tinggiBadan / 100)^2 (Pastikan tinggi badan dibagi 100 untuk diubah menjadi meter kuadrat).

Cari usia paling akhir (maksimal usia dalam hari dari historis).

Ambil data BMI Standar WHO dari tabel bmi (where: { day: { lte: usia_maksimal_anak } }). Pilih kolom yang sesuai (bmi_boy atau bmi_girl) berdasarkan jenisKelamin.

Return Format: Array of objects untuk charting: { usiaHari, bmiAnak, bmiStandarWho }.

E. Growth Tracker Percentile (Bagian 4)
GET /api/children/:id/growth/percentile

Logic:

Fetch profil Balita untuk mendapatkan tanggalLahir dan jenisKelamin.

Fetch semua data historis RekamPertumbuhan (orderBy: { tanggalCatat: 'desc' }).

Tentukan tabel yang akan digunakan (PertumbuhanLakiLaki atau PertumbuhanPerempuan) berdasarkan jenisKelamin.

Untuk setiap baris RekamPertumbuhan:

Hitung Usia Anak (dalam hari): tanggalCatat - tanggalLahir.

Query row standar WHO di tabel pertumbuhan yang bersesuaian dengan day = usia anak.

Cari Persentil Tinggi Badan: Bandingkan tinggiBadan anak dengan nilai kolom p01_height hingga p999_height untuk menemukan percentile / bracket yang paling mendekati atau dilampaui.

Cari Persentil Berat Badan: Bandingkan beratBadan anak dengan nilai kolom p01_weight hingga p999_weight untuk menemukan percentile / bracket yang paling mendekati.

Return Format: Array of objects: { tanggalCatat, usiaHari, tinggiBadan, beratBadan, persentilTinggi, persentilBerat }.