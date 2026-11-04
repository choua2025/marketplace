-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."booking_status" AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."cancelled_by" AS ENUM ('customer', 'provider');

-- CreateEnum
CREATE TYPE "public"."locale" AS ENUM ('th', 'en');

-- CreateEnum
CREATE TYPE "public"."price_unit" AS ENUM ('job', 'hour', 'day');

-- CreateEnum
CREATE TYPE "public"."role" AS ENUM ('customer', 'provider', 'admin');

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(6),
    "refresh_token_expires_at" TIMESTAMP(6),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."availability_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category_id" SMALLINT NOT NULL,
    "status" "public"."booking_status" NOT NULL DEFAULT 'pending',
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "photo_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancelled_by" "public"."cancelled_by",
    "cancel_reason" VARCHAR(500),
    "confirmed_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" SMALLSERIAL NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name_th" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" VARCHAR(2000),
    "image_key" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portfolio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" TEXT NOT NULL,
    "image_key" TEXT NOT NULL,
    "caption" VARCHAR(200),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profile_contacts" (
    "id" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "line_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "role" "public"."role" NOT NULL DEFAULT 'customer',
    "full_name" VARCHAR(100) NOT NULL,
    "avatar_key" TEXT,
    "locale" "public"."locale" NOT NULL DEFAULT 'th',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provider_categories" (
    "provider_id" TEXT NOT NULL,
    "category_id" SMALLINT NOT NULL,

    CONSTRAINT "provider_categories_provider_id_category_id_pk" PRIMARY KEY ("provider_id","category_id")
);

-- CreateTable
CREATE TABLE "public"."provider_profiles" (
    "id" TEXT NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "bio" VARCHAR(2000),
    "base_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_unit" "public"."price_unit" NOT NULL DEFAULT 'job',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "area_label" VARCHAR(200),
    "service_radius_km" INTEGER NOT NULL DEFAULT 10,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone_number" TEXT,
    "phone_number_verified" BOOLEAN,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "availability_rules_provider_weekday_start_unique" ON "public"."availability_rules"("provider_id" ASC, "weekday" ASC, "start_time" ASC);

-- CreateIndex
CREATE INDEX "bookings_customer_start_idx" ON "public"."bookings"("customer_id" ASC, "start_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_provider_start_idx" ON "public"."bookings"("provider_id" ASC, "start_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_provider_status_idx" ON "public"."bookings"("provider_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_unique" ON "public"."categories"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_customer_provider_unique" ON "public"."conversations"("customer_id" ASC, "provider_id" ASC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "public"."messages"("conversation_id" ASC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_provider_image_unique" ON "public"."portfolio_items"("provider_id" ASC, "image_key" ASC);

-- CreateIndex
CREATE INDEX "provider_categories_category_idx" ON "public"."provider_categories"("category_id" ASC);

-- CreateIndex
CREATE INDEX "provider_profiles_active_rating_idx" ON "public"."provider_profiles"("is_active" ASC, "rating_avg" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_unique" ON "public"."reviews"("booking_id" ASC);

-- CreateIndex
CREATE INDEX "reviews_provider_created_idx" ON "public"."reviews"("provider_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_unique" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_unique" ON "public"."user"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_number_unique" ON "public"."user"("phone_number" ASC);

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "public"."verification"("identifier" ASC);

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."availability_rules" ADD CONSTRAINT "availability_rules_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profile_contacts" ADD CONSTRAINT "profile_contacts_id_profiles_id_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."provider_categories" ADD CONSTRAINT "provider_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."provider_categories" ADD CONSTRAINT "provider_categories_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_id_profiles_id_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- =============================================================================
-- Custom SQL ported verbatim from the project's prior Drizzle migrations
-- (0000/0001/0003 check+exclusion constraints, 0001 triggers/functions).
-- Prisma Client does not support check constraints, exclusion constraints,
-- or triggers declaratively (see the warnings `prisma db pull` printed), so
-- this baseline migration carries them over as raw SQL. Any future change to
-- these must go through a hand-edited Prisma migration the same way.
-- =============================================================================

-- CheckConstraint
ALTER TABLE "public"."availability_rules" ADD CONSTRAINT "availability_rules_weekday_range" CHECK ("availability_rules"."weekday" between 0 and 6);
ALTER TABLE "public"."availability_rules" ADD CONSTRAINT "availability_rules_end_after_start" CHECK ("availability_rules"."end_time" > "availability_rules"."start_time");

ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_customer_not_provider" CHECK ("bookings"."customer_id" <> "bookings"."provider_id");
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_duration" CHECK ("bookings"."end_at" > "bookings"."start_at" and "bookings"."end_at" - "bookings"."start_at" <= interval '12 hours');
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_description_length" CHECK (char_length("bookings"."description") between 10 and 2000);
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_address_length" CHECK (char_length("bookings"."address") between 5 and 300);
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_photo_keys_max" CHECK (array_length("bookings"."photo_keys", 1) is null or array_length("bookings"."photo_keys", 1) <= 5);
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_cancel_reason_required" CHECK ("bookings"."status" <> 'cancelled' or "bookings"."cancel_reason" is not null);

ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_slug_format" CHECK ("categories"."slug" ~ '^[a-z0-9-]{2,40}$');

ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_body_or_image_required" CHECK ("messages"."body" is not null or "messages"."image_key" is not null);

ALTER TABLE "public"."profile_contacts" ADD CONSTRAINT "profile_contacts_phone_format" CHECK ("profile_contacts"."phone" ~ '^\+?[0-9]{8,15}$');

ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_display_name_length" CHECK (char_length("provider_profiles"."display_name") >= 2);
ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_base_price_nonnegative" CHECK ("provider_profiles"."base_price" >= 0);
ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_service_radius_range" CHECK ("provider_profiles"."service_radius_km" between 1 and 200);
ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_lat_lng_both_or_neither" CHECK (("provider_profiles"."latitude" is null) = ("provider_profiles"."longitude" is null));
ALTER TABLE "public"."provider_profiles" ADD CONSTRAINT "provider_profiles_active_requires_location" CHECK ((not "provider_profiles"."is_active") or ("provider_profiles"."latitude" is not null));

ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5);

-- ExclusionConstraint (SPEC.md section 6/7.2/7.3: database-level double-booking
-- guard; service layer catches SQLSTATE 23P01 and translates it to SLOT_TAKEN)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "public"."bookings" ADD CONSTRAINT "no_double_booking"
  EXCLUDE USING gist (
    "provider_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  )
  WHERE ("status" IN ('confirmed', 'in_progress'));

-- Generic updated_at maintenance, applied to every mutable table.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "profile_contacts_set_updated_at" BEFORE UPDATE ON "profile_contacts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "provider_profiles_set_updated_at" BEFORE UPDATE ON "provider_profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "portfolio_items_set_updated_at" BEFORE UPDATE ON "portfolio_items"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "availability_rules_set_updated_at" BEFORE UPDATE ON "availability_rules"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "bookings_set_updated_at" BEFORE UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "conversations_set_updated_at" BEFORE UPDATE ON "conversations"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "messages_set_updated_at" BEFORE UPDATE ON "messages"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "reviews_set_updated_at" BEFORE UPDATE ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep provider_profiles.rating_avg/rating_count in sync with reviews.
CREATE OR REPLACE FUNCTION update_provider_rating() RETURNS trigger AS $$
DECLARE
  affected_provider_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_provider_id := OLD.provider_id;
  ELSE
    affected_provider_id := NEW.provider_id;
  END IF;

  UPDATE "provider_profiles"
  SET
    rating_avg = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 2) FROM "reviews" WHERE provider_id = affected_provider_id),
      0
    ),
    rating_count = (SELECT COUNT(*) FROM "reviews" WHERE provider_id = affected_provider_id)
  WHERE id = affected_provider_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reviews_update_provider_rating"
  AFTER INSERT OR UPDATE OR DELETE ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating();

-- Chat real-time fan-out (SPEC.md section 7.8): notify with just the message
-- id, never the message body, and bump conversations.last_message_at.
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS trigger AS $$
BEGIN
  UPDATE "conversations" SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  PERFORM pg_notify('chat_' || NEW.conversation_id::text, NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "messages_notify_new_message"
  AFTER INSERT ON "messages"
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
