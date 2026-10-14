-- CreateTable
CREATE TABLE "follow_up" (
    "id" SERIAL NOT NULL,
    "konsultasi_id" INTEGER NOT NULL,
    "nutrition_status_evaluation" TEXT NOT NULL,
    "dietary_recommendations" TEXT NOT NULL,
    "next_evaluation_date" DATE NOT NULL,
    "special_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_konsultasi_id_key" ON "follow_up"("konsultasi_id");

-- CreateIndex
CREATE INDEX "follow_up_konsultasi_id_idx" ON "follow_up"("konsultasi_id");

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_konsultasi_id_fkey" FOREIGN KEY ("konsultasi_id") REFERENCES "konsultasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
