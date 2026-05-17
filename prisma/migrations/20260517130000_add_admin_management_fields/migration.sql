-- Add minimal admin-management fields.
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "artikel_edukasi" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "artikel_edukasi_slug_key" ON "artikel_edukasi"("slug");
