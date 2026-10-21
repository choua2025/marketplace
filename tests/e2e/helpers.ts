import type { Page } from "@playwright/test";

export const DEV_PASSWORD = "password123";

/** Seeded provider1's location (db:seed) -- used to make search deterministic. */
export const PROVIDER1_LOCATION = { latitude: 13.8167, longitude: 100.5667 };

/**
 * Logs in as a seeded dev user. Better Auth rate-limits `/sign-in*` to 3
 * requests per 10s per IP (SPEC.md section 11) -- a real security control,
 * not something to weaken for tests. Running two flows back-to-back can
 * legitimately trip it, so this backs off and retries like any well-behaved
 * client should, instead of assuming unlimited login throughput.
 */
export async function loginAsDevUser(page: Page, email: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ (dev)" }).click();

    const loggedIn = await page
      .waitForURL("**/", { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (loggedIn) return;

    await page.waitForTimeout(11_000);
  }
  throw new Error(`loginAsDevUser: failed to log in as ${email} after retries`);
}

/** A Mon-Sat slot at least `minDaysAhead` days out, formatted for <input type="datetime-local">. */
export function bookableSlot(minDaysAhead: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);
  date.setHours(hour, 0, 0, 0);
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
