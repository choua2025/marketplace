-- Opt-in: the customer agreed to have their profile photo shown on the
-- public homepage. Off by default -- photos are personal data (PDPA).
ALTER TABLE "profiles" ADD COLUMN "show_on_homepage" BOOLEAN NOT NULL DEFAULT false;
