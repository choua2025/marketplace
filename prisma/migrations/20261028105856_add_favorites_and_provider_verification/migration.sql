-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "favorites" (
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_customer_id_provider_id_pk" PRIMARY KEY ("customer_id","provider_id")
);

-- CreateTable
CREATE TABLE "provider_verifications" (
    "provider_id" TEXT NOT NULL,
    "document_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" VARCHAR(500),
    "status" "verification_status" NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" TEXT,
    "rejection_reason" VARCHAR(500),

    CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("provider_id")
);

-- CreateIndex
CREATE INDEX "favorites_provider_idx" ON "favorites"("provider_id");

-- CreateIndex
CREATE INDEX "provider_verifications_status_submitted_idx" ON "provider_verifications"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
