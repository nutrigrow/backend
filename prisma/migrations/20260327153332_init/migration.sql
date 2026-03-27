-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AHLI_GIZI', 'ADMIN');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- CreateEnum
CREATE TYPE "StatusGizi" AS ENUM ('NORMAL', 'STUNTED', 'SEVERELY_STUNTED', 'WASTED', 'SEVERELY_WASTED');

-- CreateEnum
CREATE TYPE "KategoriProduk" AS ENUM ('MPASI', 'SUPLEMEN', 'ALAT', 'PAKET');

-- CreateEnum
CREATE TYPE "KategoriArtikel" AS ENUM ('STUNTING', 'GIZI', 'MPASI', 'KEHAMILAN', 'MENYUSUI');

-- CreateEnum
CREATE TYPE "JenisTransaksi" AS ENUM ('SHOP', 'TELE_NUTRITIONIST');

-- CreateEnum
CREATE TYPE "StatusBayar" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUND');

-- CreateEnum
CREATE TYPE "StatusKonsultasi" AS ENUM ('BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balita" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "nama_anak" TEXT NOT NULL,
    "tanggal_lahir" DATE NOT NULL,
    "jenis_kelamin" "JenisKelamin" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rekam_pertumbuhan" (
    "id" SERIAL NOT NULL,
    "balita_id" INTEGER NOT NULL,
    "tanggal_catat" DATE NOT NULL,
    "berat_badan" DOUBLE PRECISION NOT NULL,
    "tinggi_badan" DOUBLE PRECISION NOT NULL,
    "z_score_bb_u" DOUBLE PRECISION,
    "z_score_tb_u" DOUBLE PRECISION,
    "z_score_bb_tb" DOUBLE PRECISION,
    "status_gizi" "StatusGizi",
    "risiko_stunting_ml" TEXT,
    "ml_confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rekam_pertumbuhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_kesehatan_ibu" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tanggal_catat" DATE NOT NULL,
    "asupan_zat_besi_mg" DOUBLE PRECISION NOT NULL,
    "jadwal_kontrol" DATE,
    "catatan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_kesehatan_ibu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produk_nutrishop" (
    "id" SERIAL NOT NULL,
    "nama_produk" TEXT NOT NULL,
    "deskripsi" TEXT,
    "kategori" "KategoriProduk" NOT NULL,
    "gambar_url" TEXT,
    "harga" INTEGER NOT NULL,
    "stok" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produk_nutrishop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaksi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "midtrans_order_id" TEXT NOT NULL,
    "midtrans_transaction_id" TEXT,
    "jenis_transaksi" "JenisTransaksi" NOT NULL,
    "total_harga" INTEGER NOT NULL,
    "status_bayar" "StatusBayar" NOT NULL DEFAULT 'PENDING',
    "snap_token" TEXT,
    "payment_type" TEXT,
    "tanggal_transaksi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_transaksi" (
    "id" SERIAL NOT NULL,
    "transaksi_id" INTEGER NOT NULL,
    "produk_id" INTEGER NOT NULL,
    "kuantitas" INTEGER NOT NULL,
    "harga_satuan" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detail_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_ahli_gizi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sertifikasi" TEXT NOT NULL,
    "spesialisasi" TEXT,
    "biaya_konsultasi" INTEGER NOT NULL,
    "foto_url" TEXT,
    "bio" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profil_ahli_gizi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konsultasi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ahli_gizi_id" INTEGER NOT NULL,
    "transaksi_id" INTEGER,
    "jadwal_sesi" TIMESTAMP(3) NOT NULL,
    "durasi_menit" INTEGER NOT NULL DEFAULT 30,
    "status" "StatusKonsultasi" NOT NULL DEFAULT 'BOOKED',
    "catatan_konsultasi" TEXT,
    "link_meeting" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "konsultasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artikel_edukasi" (
    "id" SERIAL NOT NULL,
    "judul" TEXT NOT NULL,
    "konten" TEXT NOT NULL,
    "kategori" "KategoriArtikel" NOT NULL,
    "gambar_url" TEXT,
    "penulis" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artikel_edukasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "balita_user_id_idx" ON "balita"("user_id");

-- CreateIndex
CREATE INDEX "rekam_pertumbuhan_balita_id_idx" ON "rekam_pertumbuhan"("balita_id");

-- CreateIndex
CREATE INDEX "rekam_pertumbuhan_tanggal_catat_idx" ON "rekam_pertumbuhan"("tanggal_catat");

-- CreateIndex
CREATE INDEX "log_kesehatan_ibu_user_id_idx" ON "log_kesehatan_ibu"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaksi_midtrans_order_id_key" ON "transaksi"("midtrans_order_id");

-- CreateIndex
CREATE INDEX "transaksi_user_id_idx" ON "transaksi"("user_id");

-- CreateIndex
CREATE INDEX "transaksi_status_bayar_idx" ON "transaksi"("status_bayar");

-- CreateIndex
CREATE INDEX "detail_transaksi_transaksi_id_idx" ON "detail_transaksi"("transaksi_id");

-- CreateIndex
CREATE UNIQUE INDEX "profil_ahli_gizi_user_id_key" ON "profil_ahli_gizi"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "konsultasi_transaksi_id_key" ON "konsultasi"("transaksi_id");

-- CreateIndex
CREATE INDEX "konsultasi_user_id_idx" ON "konsultasi"("user_id");

-- CreateIndex
CREATE INDEX "konsultasi_ahli_gizi_id_idx" ON "konsultasi"("ahli_gizi_id");

-- CreateIndex
CREATE INDEX "konsultasi_jadwal_sesi_idx" ON "konsultasi"("jadwal_sesi");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "balita" ADD CONSTRAINT "balita_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rekam_pertumbuhan" ADD CONSTRAINT "rekam_pertumbuhan_balita_id_fkey" FOREIGN KEY ("balita_id") REFERENCES "balita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_kesehatan_ibu" ADD CONSTRAINT "log_kesehatan_ibu_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_transaksi_id_fkey" FOREIGN KEY ("transaksi_id") REFERENCES "transaksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk_nutrishop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_ahli_gizi" ADD CONSTRAINT "profil_ahli_gizi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsultasi" ADD CONSTRAINT "konsultasi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsultasi" ADD CONSTRAINT "konsultasi_ahli_gizi_id_fkey" FOREIGN KEY ("ahli_gizi_id") REFERENCES "profil_ahli_gizi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsultasi" ADD CONSTRAINT "konsultasi_transaksi_id_fkey" FOREIGN KEY ("transaksi_id") REFERENCES "transaksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
