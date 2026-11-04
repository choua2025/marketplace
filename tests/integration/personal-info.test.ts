import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { getMyPersonalInfo, updatePersonalInfo } from "@/server/services/profile";
import type { Actor } from "@/server/lib/actor";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

const PROVIDER: Actor = { id: "prov1", role: "provider" };

beforeEach(async () => {
  await resetTestDatabase();
  await testOwnerDb.user.create({
    data: { id: "prov1", name: "Old Name", email: "prov1@test.local", phoneNumber: "+66810000001" },
  });
  await testOwnerDb.profile.create({
    data: { id: "prov1", role: "provider", fullName: "Old Name" },
  });
});

describe("getMyPersonalInfo", () => {
  it("suggests the sign-up phone until a contact phone is saved", async () => {
    const info = await getMyPersonalInfo(PROVIDER);
    expect(info).toMatchObject({
      fullName: "Old Name",
      email: "prov1@test.local",
      phone: "+66810000001",
      lineId: null,
    });
  });

  it("requires a signed-in user", async () => {
    await expect(getMyPersonalInfo(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("updatePersonalInfo", () => {
  it("saves name (on both profile and user), normalized phone and LINE ID", async () => {
    await updatePersonalInfo(PROVIDER, {
      fullName: "  สมชาย ใจดี  ",
      phone: "081-234 5678",
      lineId: " somchai123 ",
    });

    const profile = await testOwnerDb.profile.findUnique({ where: { id: "prov1" } });
    const user = await testOwnerDb.user.findUnique({ where: { id: "prov1" } });
    const contact = await testOwnerDb.profileContact.findUnique({ where: { id: "prov1" } });
    expect(profile?.fullName).toBe("สมชาย ใจดี");
    expect(user?.name).toBe("สมชาย ใจดี");
    expect(contact).toMatchObject({ phone: "0812345678", lineId: "somchai123" });

    // Email and the sign-up phone are untouched.
    expect(user).toMatchObject({ email: "prov1@test.local", phoneNumber: "+66810000001" });
  });

  it("clears phone and LINE ID when left empty", async () => {
    await updatePersonalInfo(PROVIDER, { fullName: "A Name", phone: "0812345678", lineId: "x" });
    await updatePersonalInfo(PROVIDER, { fullName: "A Name", phone: "", lineId: "" });

    const contact = await testOwnerDb.profileContact.findUnique({ where: { id: "prov1" } });
    expect(contact).toMatchObject({ phone: null, lineId: null });
  });

  it("rejects an invalid phone and a too-short name", async () => {
    await expect(
      updatePersonalInfo(PROVIDER, { fullName: "A Name", phone: "call me", lineId: "" }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      updatePersonalInfo(PROVIDER, { fullName: " a ", phone: "", lineId: "" }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("only ever updates the signed-in user's own record", async () => {
    await testOwnerDb.user.create({ data: { id: "other", name: "Other", email: "o@test.local" } });
    await testOwnerDb.profile.create({
      data: { id: "other", role: "provider", fullName: "Other" },
    });

    await updatePersonalInfo(PROVIDER, {
      fullName: "Changed",
      phone: "",
      lineId: "",
      // Extra fields are ignored -- there is no way to target another account.
      id: "other",
    } as never);

    const other = await testOwnerDb.profile.findUnique({ where: { id: "other" } });
    expect(other?.fullName).toBe("Other");
  });
});
