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
    // exact: the show/hide button next to the field is labelled "แสดงรหัสผ่าน".
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();

    const loggedIn = await page
      .waitForURL("**/", { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (loggedIn) return;

    await page.waitForTimeout(11_000);
  }
  throw new Error(`loginAsDevUser: failed to log in as ${email} after retries`);
}

/**
 * Picks a Mon-Sat day at least `minDaysAhead` days out (seeded providers work
 * Mon-Sat 08:00-18:00, Bangkok time) and a start/end time ("HH:MM") in the
 * booking form's time picker.
 */
export async function pickBookingSlot(
  page: Page,
  minDaysAhead: number,
  start: string,
  end: string,
): Promise<void> {
  const day = new Date(Date.now() + minDaysAhead * 24 * 60 * 60 * 1000);
  const bangkokDate = () => day.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const bangkokWeekday = () =>
    day.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", weekday: "short" });
  while (bangkokWeekday() === "Sun") day.setTime(day.getTime() + 24 * 60 * 60 * 1000);

  await page.locator(`[data-date="${bangkokDate()}"]`).click();
  await page
    .getByRole("group", { name: "วันเวลาเริ่มงาน" })
    .getByRole("button", { name: start, exact: true })
    .click();
  await page
    .getByRole("group", { name: "ถึงเวลา" })
    .getByRole("button", { name: end, exact: true })
    .click();
}
