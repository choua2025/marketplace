import { expect, test } from "@playwright/test";
import { bookableSlot, loginAsDevUser } from "./helpers";

const PROVIDER2_LOCATION = { latitude: 13.6672, longitude: 100.6039 };
const CUSTOMER2_NAME = "วิชัย รักเรียน";

/**
 * Flow B (SPEC.md section 12): provider logs in -> sees the new request ->
 * replies to the customer in chat (a second tab sees it arrive in
 * real-time) -> confirms -> starts -> completes the job.
 */
test("provider sees new request, chats in real-time, confirms/starts/completes", async ({
  browser,
}) => {
  const customer = await browser.newContext({
    geolocation: PROVIDER2_LOCATION,
    permissions: ["geolocation"],
    locale: "th-TH",
  });
  const provider = await browser.newContext({ locale: "th-TH" });

  const customerPage = await customer.newPage();
  const providerPage = await provider.newPage();

  // A per-run nonce keeps message text unique across repeated local runs
  // against the persistent dev database (unlike integration tests, there's
  // no per-test truncation here).
  const nonce = Date.now();
  const customerMessage = `อยากสอบถามเรื่องงานซ่อมไฟครับ #${nonce}`;
  const providerMessage = `รับงานนี้ได้เลยครับ #${nonce}`;

  await loginAsDevUser(customerPage, "customer2@changdee.test");

  // Customer creates a booking request for provider2.
  await customerPage.goto("/book/seed_provider_2");
  await customerPage.getByLabel("วันเวลาเริ่มงาน").fill(bookableSlot(2, 10));
  await customerPage.getByLabel("ถึงเวลา").fill(bookableSlot(2, 11));
  await customerPage.getByLabel("อธิบายปัญหา").fill("ไฟในบ้านดับบ่อย อยากให้ช่างมาตรวจระบบไฟ");
  await customerPage.getByLabel("ที่อยู่ที่ให้บริการ").fill("99 ถนนบางนา กรุงเทพฯ");
  await customerPage.getByRole("button", { name: "ส่งคำขอจอง" }).click();
  await customerPage.waitForURL("**/bookings/*");
  const bookingId = customerPage.url().split("/bookings/")[1];
  expect(bookingId).toBeTruthy();

  // Customer starts a chat with the provider and sends the first message.
  await customerPage.goto("/p/seed_provider_2");
  await customerPage.getByRole("button", { name: "แชทกับช่างนี้" }).click();
  await customerPage.waitForURL("**/messages/*");
  await customerPage.getByPlaceholder("พิมพ์ข้อความ...").fill(customerMessage);
  await customerPage.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(
    customerPage.getByRole("paragraph").filter({ hasText: customerMessage }),
  ).toBeVisible();

  // Provider logs in and sees the new request on the dashboard.
  await loginAsDevUser(providerPage, "provider2@changdee.test");
  await providerPage.goto("/dashboard");
  await expect(providerPage.getByText(CUSTOMER2_NAME).first()).toBeVisible();

  // Provider replies in chat.
  await providerPage.goto("/messages");
  await providerPage.getByText(CUSTOMER2_NAME).click();
  await expect(
    providerPage.getByRole("paragraph").filter({ hasText: customerMessage }),
  ).toBeVisible();
  await providerPage.getByPlaceholder("พิมพ์ข้อความ...").fill(providerMessage);
  await providerPage.getByRole("button", { name: "ส่งข้อความ" }).click();

  // The customer's already-open chat tab sees the reply arrive via SSE,
  // without reloading the page -- this is the real-time check.
  await expect(
    customerPage.getByRole("paragraph").filter({ hasText: providerMessage }),
  ).toBeVisible({ timeout: 10_000 });

  // Provider confirms, starts, and completes the job.
  await providerPage.goto(`/bookings/${bookingId}`);
  await providerPage.getByRole("button", { name: "ยืนยันรับงาน" }).click();
  await providerPage.getByRole("button", { name: "เริ่มงาน" }).click();
  await providerPage.getByRole("button", { name: "งานเสร็จแล้ว" }).click();
  await expect(providerPage.getByText("เสร็จแล้ว")).toBeVisible();

  await customer.close();
  await provider.close();
});
