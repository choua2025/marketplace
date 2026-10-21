import { expect, test } from "@playwright/test";
import { bookableSlot, loginAsDevUser, PROVIDER1_LOCATION } from "./helpers";

const PROVIDER_NAME = "ร้านแอร์เย็นสบาย";

/**
 * Flow A (SPEC.md section 12): customer searches -> opens profile -> books
 * -> (provider confirms) -> sees phone -> (provider completes) -> reviews.
 */
test("customer books a provider, provider confirms/completes, customer reviews", async ({
  browser,
}) => {
  const customer = await browser.newContext({
    geolocation: PROVIDER1_LOCATION,
    permissions: ["geolocation"],
    locale: "th-TH",
  });
  const provider = await browser.newContext({ locale: "th-TH" });

  const customerPage = await customer.newPage();
  const providerPage = await provider.newPage();

  await loginAsDevUser(customerPage, "customer1@changdee.test");

  // Search -> open profile.
  await customerPage.goto("/search");
  await customerPage.getByText(PROVIDER_NAME).click();
  await customerPage.waitForURL("**/p/seed_provider_1");

  // Open booking form and submit.
  await customerPage.getByRole("link", { name: "จองงานกับช่างนี้" }).click();
  await customerPage.waitForURL("**/book/seed_provider_1");

  await customerPage.getByLabel("วันเวลาเริ่มงาน").fill(bookableSlot(2, 10));
  await customerPage.getByLabel("ถึงเวลา").fill(bookableSlot(2, 12));
  await customerPage
    .getByLabel("อธิบายปัญหา")
    .fill("แอร์ไม่เย็น ขอให้ช่างมาตรวจสอบและล้างแอร์ให้หน่อยครับ");
  await customerPage.getByLabel("ที่อยู่ที่ให้บริการ").fill("123/45 ถนนลาดพร้าว กรุงเทพฯ");
  await customerPage.getByRole("button", { name: "ส่งคำขอจอง" }).click();

  await customerPage.waitForURL("**/bookings/*");
  const bookingId = customerPage.url().split("/bookings/")[1];
  expect(bookingId).toBeTruthy();

  // Before confirmation, the customer can't see the provider's phone.
  await expect(customerPage.getByText("จะเห็นข้อมูลติดต่อหลังช่างยืนยันงานแล้ว")).toBeVisible();

  // Provider confirms.
  await loginAsDevUser(providerPage, "provider1@changdee.test");
  await providerPage.goto(`/bookings/${bookingId}`);
  await providerPage.getByRole("button", { name: "ยืนยันรับงาน" }).click();
  await expect(providerPage.getByRole("button", { name: "เริ่มงาน" })).toBeVisible();

  // Customer now sees the phone number.
  await customerPage.reload();
  await expect(customerPage.getByText("จะเห็นข้อมูลติดต่อหลังช่างยืนยันงานแล้ว")).not.toBeVisible();
  await expect(customerPage.getByText("โทร:")).toBeVisible();

  // Provider starts and completes the job.
  await providerPage.getByRole("button", { name: "เริ่มงาน" }).click();
  await expect(providerPage.getByRole("button", { name: "งานเสร็จแล้ว" })).toBeVisible();
  await providerPage.getByRole("button", { name: "งานเสร็จแล้ว" }).click();
  // Wait for the status update to actually commit before the customer
  // reloads, otherwise the reload can race ahead of it.
  await expect(providerPage.getByText("เสร็จแล้ว")).toBeVisible();

  // Customer writes a review.
  await customerPage.reload();
  await customerPage.getByText("เขียนรีวิว").click();
  await customerPage.waitForURL(`**/bookings/${bookingId}/review`);
  await customerPage.getByRole("button", { name: "5 ดาว" }).click();
  await customerPage.getByLabel("ความเห็น (ไม่บังคับ)").fill("บริการดีมาก ช่างมาตรงเวลา");
  await customerPage.getByRole("button", { name: "ส่งรีวิว" }).click();

  await customerPage.waitForURL(`**/bookings/${bookingId}`);
  await expect(customerPage.getByText("บริการดีมาก ช่างมาตรงเวลา")).toBeVisible();

  await customer.close();
  await provider.close();
});
