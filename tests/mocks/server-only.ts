// Next.js aliases the real `server-only` package to a no-op during its own
// build; outside that bundler it throws unconditionally, so tests alias it
// to this empty module instead (see vitest.config.ts).
export {};
