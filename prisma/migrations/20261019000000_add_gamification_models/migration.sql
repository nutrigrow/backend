-- CreateTable
CREATE TABLE "poin_transaksi" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "jenis_aktivitas" TEXT NOT NULL,
    "poin" INTEGER NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "referensi_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poin_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penukaran_hadiah" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reward_id" TEXT NOT NULL,
    "nama_hadiah" TEXT NOT NULL,
    "biaya_poin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penukaran_hadiah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_baca_artikel" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "artikel_id" INTEGER NOT NULL,
    "tanggal_baca" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_baca_artikel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poin_transaksi_user_id_idx" ON "poin_transaksi"("user_id");

-- CreateIndex
CREATE INDEX "poin_transaksi_referensi_id_idx" ON "poin_transaksi"("referensi_id");

-- CreateIndex
CREATE INDEX "penukaran_hadiah_user_id_idx" ON "penukaran_hadiah"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_baca_artikel_user_id_artikel_id_tanggal_baca_key" ON "riwayat_baca_artikel"("user_id", "artikel_id", "tanggal_baca");

-- CreateIndex
CREATE INDEX "riwayat_baca_artikel_user_id_idx" ON "riwayat_baca_artikel"("user_id");

-- AddForeignKey
ALTER TABLE "poin_transaksi" ADD CONSTRAINT "poin_transaksi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penukaran_hadiah" ADD CONSTRAINT "penukaran_hadiah_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_baca_artikel" ADD CONSTRAINT "riwayat_baca_artikel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
