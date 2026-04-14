/*
  Warnings:

  - You are about to drop the column `nama_anak` on the `balita` table. All the data in the column will be lost.
  - Added the required column `nama_depan` to the `balita` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "balita" DROP COLUMN "nama_anak",
ADD COLUMN     "nama_akhir" TEXT,
ADD COLUMN     "nama_depan" TEXT NOT NULL;
