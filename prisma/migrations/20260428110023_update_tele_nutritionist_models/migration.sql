/*
  Warnings:

  - You are about to drop the column `biaya_konsultasi` on the `profil_ahli_gizi` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MetodeKonsultasi" AS ENUM ('VIDEO_CALL', 'CHAT');

-- AlterTable
ALTER TABLE "konsultasi" ADD COLUMN     "metode" "MetodeKonsultasi" NOT NULL DEFAULT 'VIDEO_CALL';

-- AlterTable
ALTER TABLE "profil_ahli_gizi" DROP COLUMN "biaya_konsultasi",
ADD COLUMN     "biaya_chat" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "biaya_video_call" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bidang_keahlian" JSONB,
ADD COLUMN     "gelar" TEXT,
ADD COLUMN     "jadwal" JSONB,
ADD COLUMN     "pendidikan" JSONB,
ADD COLUMN     "pengalaman_tahun" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrasi_medis" TEXT;
