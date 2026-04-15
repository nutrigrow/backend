/*
  Warnings:

  - You are about to drop the `log_kesehatan_ibu` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FaseKesehatan" AS ENUM ('REMAJA', 'HAMIL', 'MENYUSUI');

-- DropForeignKey
ALTER TABLE "log_kesehatan_ibu" DROP CONSTRAINT "log_kesehatan_ibu_user_id_fkey";

-- DropTable
DROP TABLE "log_kesehatan_ibu";

-- CreateTable
CREATE TABLE "log_kesehatan" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tanggal_catat" DATE NOT NULL,
    "day" TEXT NOT NULL,
    "fase" "FaseKesehatan" NOT NULL,
    "jumlah_gelas_air" INTEGER NOT NULL,
    "durasi_tidur" DOUBLE PRECISION NOT NULL,
    "minum_suplemen" BOOLEAN NOT NULL DEFAULT false,
    "mood" INTEGER NOT NULL,
    "sedang_haid" BOOLEAN,
    "berat_badan_kg" DOUBLE PRECISION,
    "frekuensi_menyusui" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_kesehatan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_kesehatan_user_id_idx" ON "log_kesehatan"("user_id");

-- CreateIndex
CREATE INDEX "log_kesehatan_tanggal_catat_idx" ON "log_kesehatan"("tanggal_catat");

-- CreateIndex
CREATE UNIQUE INDEX "log_kesehatan_user_id_tanggal_catat_key" ON "log_kesehatan"("user_id", "tanggal_catat");

-- AddForeignKey
ALTER TABLE "log_kesehatan" ADD CONSTRAINT "log_kesehatan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
