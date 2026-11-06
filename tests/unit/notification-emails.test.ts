import { describe, expect, it } from "vitest";
import { buildNewBookingEmail, buildNewMessageEmail } from "@/server/email/notification-emails";

describe("buildNewBookingEmail", () => {
  it("names the customer, job and time, with the link in text and HTML", () => {
    const url = "http://localhost:3000/en/bookings/abc";
    const email = buildNewBookingEmail({
      to: "p@b.test",
      locale: "en",
      providerName: "Somchai Air",
      customerName: "Ann",
      categoryName: "Air conditioning",
      when: "Monday 9 November 2026 at 10:00",
      url,
    });
    expect(email.subject).toBe("New booking request from Ann - ChangDee");
    expect(email.text).toContain("Hi Somchai Air");
    expect(email.text).toContain(
      "Ann wants to book Air conditioning on Monday 9 November 2026 at 10:00.",
    );
    expect(email.text).toContain(url);
    expect(email.html).toContain(url);
  });
});

describe("buildNewMessageEmail", () => {
  const base = {
    to: "c@b.test",
    locale: "th" as const,
    recipientName: "แอน",
    senderName: "ช่างสมชาย",
    url: "http://localhost:3000/messages/abc",
  };

  it("quotes the message and escapes HTML in it", () => {
    const email = buildNewMessageEmail({
      ...base,
      body: '<script>alert("x")</script> พรุ่งนี้ว่างไหม',
    });
    expect(email.subject).toBe("ข้อความใหม่จาก ช่างสมชาย - ช่างดี");
    expect(email.text).toContain("พรุ่งนี้ว่างไหม");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("shortens long messages and describes photo-only ones", () => {
    const long = buildNewMessageEmail({ ...base, body: "ก".repeat(500) });
    expect(long.text).toContain(`${"ก".repeat(200)}…`);
    expect(long.text).not.toContain("ก".repeat(201));

    const photo = buildNewMessageEmail({ ...base, body: null });
    expect(photo.text).toContain("[ส่งรูปภาพ]");
  });
});
