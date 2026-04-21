-- AlterTable
ALTER TABLE "bmi" ADD COLUMN     "sd2neg_boy" DOUBLE PRECISION,
ADD COLUMN     "sd2neg_girl" DOUBLE PRECISION,
ADD COLUMN     "sd2pos_boy" DOUBLE PRECISION,
ADD COLUMN     "sd2pos_girl" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tinggi_badan" DOUBLE PRECISION;
