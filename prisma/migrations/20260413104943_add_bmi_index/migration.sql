-- CreateTable
CREATE TABLE "bmi" (
    "id" SERIAL NOT NULL,
    "day" INTEGER NOT NULL,
    "bmi_girl" DOUBLE PRECISION,
    "bmi_boy" DOUBLE PRECISION,

    CONSTRAINT "bmi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bmi_day_key" ON "bmi"("day");
