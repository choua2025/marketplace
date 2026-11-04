-- Better Auth generates UUID ids app-side (advanced.database.generateId);
-- this default covers any insert that doesn't supply one.
-- Columns stay TEXT: existing ids (seed data, earlier random ids) aren't
-- UUIDs, and profiles/session/account reference user.id as text.
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
