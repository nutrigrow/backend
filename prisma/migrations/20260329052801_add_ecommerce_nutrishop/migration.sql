-- CreateEnum
CREATE TYPE "MetodePengiriman" AS ENUM ('STANDARD', 'EXPRESS');

-- AlterTable
ALTER TABLE "transaksi" ADD COLUMN     "alamat_id" INTEGER,
ADD COLUMN     "biaya_pengiriman" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metode_pengiriman" "MetodePengiriman";

-- CreateTable
CREATE TABLE "keranjang" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "produk_id" INTEGER NOT NULL,
    "kuantitas" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keranjang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alamat_pengiriman" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "nama_penerima" TEXT NOT NULL,
    "no_telepon" TEXT NOT NULL,
    "alamat_lengkap" TEXT NOT NULL,
    "kelurahan" TEXT NOT NULL,
    "kecamatan" TEXT NOT NULL,
    "kota" TEXT NOT NULL,
    "kode_pos" TEXT NOT NULL,
    "is_utama" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alamat_pengiriman_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keranjang_user_id_idx" ON "keranjang"("user_id");

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_alamat_id_fkey" FOREIGN KEY ("alamat_id") REFERENCES "alamat_pengiriman"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keranjang" ADD CONSTRAINT "keranjang_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keranjang" ADD CONSTRAINT "keranjang_produk_id_fkey" FOREIGN KEY ("produk_id") REFERENCES "produk_nutrishop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alamat_pengiriman" ADD CONSTRAINT "alamat_pengiriman_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
