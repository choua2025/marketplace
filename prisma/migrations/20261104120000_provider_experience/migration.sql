-- Self-reported "in this trade since" year, shown as years of experience.
-- The upper bound (current year) is enforced in the app: a CHECK can't use now().
ALTER TABLE "provider_profiles" ADD COLUMN "experience_since_year" SMALLINT;
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_experience_since_year_check"
  CHECK ("experience_since_year" BETWEEN 1950 AND 2200);
