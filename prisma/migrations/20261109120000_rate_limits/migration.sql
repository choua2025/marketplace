-- Rate-limit counters (SPEC.md section 11), shared by every app process and
-- kept across restarts -- in-memory counters reset on each deploy and don't
-- add up across processes. One fixed-window counter per key; expired rows
-- are deleted from time to time by src/server/lib/rate-limit.ts.
--
-- UNLOGGED: skips the write-ahead log, so the counter updates on every
-- request stay cheap. A database crash empties the table, which only resets
-- the counters -- acceptable for rate limits.
CREATE UNLOGGED TABLE "rate_limits" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits"("reset_at");
