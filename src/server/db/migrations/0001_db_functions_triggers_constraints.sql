-- SPEC.md section 6: "สิ่งที่ต้องทำใน custom SQL migration"

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- 1. Database-level double-booking guard. Service layer must catch
--    error code 23P01 and translate it to SLOT_TAKEN (SPEC.md section 7.2/7.3).
ALTER TABLE "bookings" ADD CONSTRAINT "no_double_booking"
  EXCLUDE USING gist (
    "provider_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  )
  WHERE ("status" IN ('confirmed', 'in_progress'));
--> statement-breakpoint

-- 2. Generic updated_at maintenance, applied to every mutable table.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "profile_contacts_set_updated_at" BEFORE UPDATE ON "profile_contacts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "provider_profiles_set_updated_at" BEFORE UPDATE ON "provider_profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "portfolio_items_set_updated_at" BEFORE UPDATE ON "portfolio_items"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "availability_rules_set_updated_at" BEFORE UPDATE ON "availability_rules"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "bookings_set_updated_at" BEFORE UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "conversations_set_updated_at" BEFORE UPDATE ON "conversations"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "messages_set_updated_at" BEFORE UPDATE ON "messages"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "reviews_set_updated_at" BEFORE UPDATE ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- 3. Keep provider_profiles.rating_avg/rating_count in sync with reviews.
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
--> statement-breakpoint

CREATE TRIGGER "reviews_update_provider_rating"
  AFTER INSERT OR UPDATE OR DELETE ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating();
--> statement-breakpoint

-- 4. Chat real-time fan-out (SPEC.md section 7.8): notify with just the
--    message id, never the message body, and bump conversations.last_message_at.
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS trigger AS $$
BEGIN
  UPDATE "conversations" SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  PERFORM pg_notify('chat_' || NEW.conversation_id::text, NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "messages_notify_new_message"
  AFTER INSERT ON "messages"
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
--> statement-breakpoint

-- 5. Indexes for the hot paths listed in SPEC.md section 6.
CREATE INDEX "bookings_customer_start_idx" ON "bookings" ("customer_id", "start_at" DESC);
--> statement-breakpoint
CREATE INDEX "bookings_provider_start_idx" ON "bookings" ("provider_id", "start_at" DESC);
--> statement-breakpoint
CREATE INDEX "bookings_provider_status_idx" ON "bookings" ("provider_id", "status");
--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" ("conversation_id", "id" DESC);
--> statement-breakpoint
CREATE INDEX "reviews_provider_created_idx" ON "reviews" ("provider_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "provider_profiles_active_rating_idx" ON "provider_profiles" ("is_active", "rating_avg" DESC);
--> statement-breakpoint
CREATE INDEX "provider_categories_category_idx" ON "provider_categories" ("category_id");
