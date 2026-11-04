import { hashPassword } from "better-auth/crypto";
import { timeStringToDate } from "@/server/lib/pg-time";
import { db } from "./client";
import { SEED_IDS, seedUuid } from "./seed-ids";

const DEV_PASSWORD = "password123";

const CATEGORY_DEFS = [
  {
    slug: "air-conditioner",
    nameTh: "ช่างแอร์",
    nameEn: "Air Conditioner",
    icon: "wind",
    sortOrder: 1,
  },
  { slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap", sortOrder: 2 },
  { slug: "plumber", nameTh: "ช่างประปา", nameEn: "Plumber", icon: "wrench", sortOrder: 3 },
  {
    slug: "cleaning",
    nameTh: "แม่บ้าน/ทำความสะอาด",
    nameEn: "Cleaning",
    icon: "sparkles",
    sortOrder: 4,
  },
  { slug: "photographer", nameTh: "ช่างภาพ", nameEn: "Photographer", icon: "camera", sortOrder: 5 },
  {
    slug: "graphic-design",
    nameTh: "กราฟิกดีไซน์",
    nameEn: "Graphic Design",
    icon: "palette",
    sortOrder: 6,
  },
] as const;

const CUSTOMER_DEFS = [
  { id: SEED_IDS.customer(1), email: "customer1@changdee.test", fullName: "สมหญิง ใจดี" },
  { id: SEED_IDS.customer(2), email: "customer2@changdee.test", fullName: "วิชัย รักเรียน" },
  { id: SEED_IDS.customer(3), email: "customer3@changdee.test", fullName: "กมลชนก ศรีสุข" },
  { id: SEED_IDS.customer(4), email: "customer4@changdee.test", fullName: "ธนพล มั่นคง" },
  { id: SEED_IDS.customer(5), email: "customer5@changdee.test", fullName: "ปิยะนุช แก้วใส" },
] as const;

const ADMIN_DEF = {
  id: SEED_IDS.admin,
  email: "admin@gmail.com",
  password: "admin123",
  fullName: "แอดมิน ระบบ",
} as const;

type ProviderDef = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  categorySlugs: readonly string[];
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  latitude: string;
  longitude: string;
  areaLabel: string;
  isVerified: boolean;
  reviewCount: number;
};

// Five providers covering all six categories. provider1/provider2 keep the
// names, locations and categories the e2e flows (tests/e2e) rely on.
const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: SEED_IDS.provider(1),
    email: "provider1@changdee.test",
    displayName: "ร้านแอร์เย็นสบาย",
    bio: "บริการล้างแอร์ ซ่อมแอร์ ติดตั้งแอร์บ้านและคอนโด ประสบการณ์กว่า 10 ปี งานไว ราคาเป็นกันเอง",
    categorySlugs: ["air-conditioner"],
    basePrice: "1200.00",
    priceUnit: "job",
    latitude: "13.816700",
    longitude: "100.566700",
    areaLabel: "ลาดพร้าว, กรุงเทพฯ",
    isVerified: true,
    reviewCount: 4,
  },
  {
    id: SEED_IDS.provider(2),
    email: "provider2@changdee.test",
    displayName: "ช่างไฟสมชาย บริการ",
    bio: "ซ่อมไฟฟ้าในบ้าน เดินสายไฟใหม่ แก้ปัญหาไฟดับ ไฟรั่ว บริการตลอดพื้นที่กรุงเทพฯ",
    categorySlugs: ["electrician"],
    basePrice: "350.00",
    priceUnit: "hour",
    latitude: "13.667200",
    longitude: "100.603900",
    areaLabel: "บางนา, กรุงเทพฯ",
    isVerified: false,
    reviewCount: 2,
  },
  {
    id: SEED_IDS.provider(3),
    email: "provider3@changdee.test",
    displayName: "ประปาด่วน 24 ชม.",
    bio: "แก้ท่อตัน ท่อแตก ซ่อมก๊อกน้ำ ติดตั้งเครื่องทำน้ำอุ่น บริการฉุกเฉินตลอด 24 ชั่วโมง",
    categorySlugs: ["plumber"],
    basePrice: "500.00",
    priceUnit: "job",
    latitude: "13.859100",
    longitude: "100.521400",
    areaLabel: "เมืองนนทบุรี, นนทบุรี",
    isVerified: true,
    reviewCount: 3,
  },
  {
    id: SEED_IDS.provider(4),
    email: "provider4@changdee.test",
    displayName: "แม่บ้านมืออาชีพ สะอาดใจ",
    bio: "ทำความสะอาดบ้าน คอนโด ออฟฟิศ ทีมงานมืออาชีพ ซื่อสัตย์ไว้ใจได้ จองล่วงหน้าได้",
    categorySlugs: ["cleaning"],
    basePrice: "150.00",
    priceUnit: "hour",
    latitude: "13.764900",
    longitude: "100.574700",
    areaLabel: "ห้วยขวาง, กรุงเทพฯ",
    isVerified: false,
    reviewCount: 2,
  },
  {
    id: SEED_IDS.provider(5),
    email: "provider5@changdee.test",
    displayName: "ภาพสวยโฟโต้ & ดีไซน์ สตูดิโอ",
    bio: "รับถ่ายภาพพอร์ตเทรต สินค้า และงานอีเวนต์ พร้อมออกแบบโลโก้และสื่อโซเชียลมีเดีย แต่งภาพให้ฟรีทุกงาน",
    categorySlugs: ["photographer", "graphic-design"],
    basePrice: "3500.00",
    priceUnit: "job",
    latitude: "13.730700",
    longitude: "100.582600",
    areaLabel: "ทองหล่อ, กรุงเทพฯ",
    isVerified: true,
    reviewCount: 4,
  },
];

const WEEKDAYS_MON_TO_SAT = [1, 2, 3, 4, 5, 6] as const;

// Deterministic (not random) so re-running `pnpm db:seed` hits the same
// primary keys and no-ops via upsert({update: {}}) instead of piling up
// duplicate bookings/reviews each run.
function pickCustomer(index: number): (typeof CUSTOMER_DEFS)[number] {
  const customer = CUSTOMER_DEFS[index % CUSTOMER_DEFS.length];
  if (!customer) throw new Error("CUSTOMER_DEFS must not be empty");
  return customer;
}

// `syncCredentials` makes a re-run apply changed seed email/password to an
// existing account; otherwise existing accounts are left untouched.
async function createUserWithCredentials(
  id: string,
  email: string,
  name: string,
  passwordHash: string,
  { syncCredentials = false } = {},
) {
  await db.user.upsert({
    where: { id },
    create: { id, name, email, emailVerified: true },
    update: syncCredentials ? { email } : {},
  });
  await db.account.upsert({
    where: { id: seedUuid(`account:${id}`) },
    create: {
      id: seedUuid(`account:${id}`),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
      updatedAt: new Date(),
    },
    update: syncCredentials ? { password: passwordHash, updatedAt: new Date() } : {},
  });
}

async function seedCategories() {
  for (const def of CATEGORY_DEFS) {
    await db.category.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        nameTh: def.nameTh,
        nameEn: def.nameEn,
        icon: def.icon,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
  return db.category.findMany();
}

async function seedCustomers(passwordHash: string) {
  for (const [index, customer] of CUSTOMER_DEFS.entries()) {
    await createUserWithCredentials(customer.id, customer.email, customer.fullName, passwordHash);
    await db.profile.upsert({
      where: { id: customer.id },
      create: { id: customer.id, role: "customer", fullName: customer.fullName },
      update: {},
    });
    await db.profileContact.upsert({
      where: { id: customer.id },
      create: { id: customer.id, phone: `+6681${String(index).padStart(7, "0")}` },
      update: {},
    });
  }
}

async function seedAdmin() {
  const passwordHash = await hashPassword(ADMIN_DEF.password);
  await createUserWithCredentials(ADMIN_DEF.id, ADMIN_DEF.email, ADMIN_DEF.fullName, passwordHash, {
    syncCredentials: true,
  });
  await db.profile.upsert({
    where: { id: ADMIN_DEF.id },
    create: { id: ADMIN_DEF.id, role: "admin", fullName: ADMIN_DEF.fullName },
    update: {},
  });
}

async function seedProviders(
  passwordHash: string,
  categoryBySlug: Map<string, number>,
): Promise<void> {
  for (const [index, def] of PROVIDER_DEFS.entries()) {
    await createUserWithCredentials(def.id, def.email, def.displayName, passwordHash);
    await db.profile.upsert({
      where: { id: def.id },
      create: { id: def.id, role: "provider", fullName: def.displayName },
      update: {},
    });
    await db.profileContact.upsert({
      where: { id: def.id },
      create: { id: def.id, phone: `+6682${String(index).padStart(7, "0")}` },
      update: {},
    });
    await db.providerProfile.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        displayName: def.displayName,
        bio: def.bio,
        basePrice: def.basePrice,
        priceUnit: def.priceUnit,
        latitude: def.latitude,
        longitude: def.longitude,
        areaLabel: def.areaLabel,
        isActive: true,
        isVerified: def.isVerified,
      },
      update: {},
    });

    for (const slug of def.categorySlugs) {
      const categoryId = categoryBySlug.get(slug);
      if (categoryId === undefined) throw new Error(`Unknown category slug in seed data: ${slug}`);
      await db.providerCategory.upsert({
        where: { providerId_categoryId: { providerId: def.id, categoryId } },
        create: { providerId: def.id, categoryId },
        update: {},
      });
    }

    for (const weekday of WEEKDAYS_MON_TO_SAT) {
      const startTime = timeStringToDate("08:00:00");
      await db.availabilityRule.upsert({
        where: { providerId_weekday_startTime: { providerId: def.id, weekday, startTime } },
        create: { providerId: def.id, weekday, startTime, endTime: timeStringToDate("18:00:00") },
        update: {},
      });
    }
    // No seeded portfolio: a placeholder image only rendered as an empty grey
    // box. Providers' portfolios start empty and the section stays hidden.
  }
}

const REVIEW_COMMENTS = [
  "บริการดีมาก ตรงเวลา งานเรียบร้อย",
  "ราคาสมเหตุสมผล ทำงานละเอียด แนะนำเลย",
  "ประทับใจมาก ช่างสุภาพ อธิบายละเอียด",
  "งานเร็วและเรียบร้อยดี จะใช้บริการอีกแน่นอน",
];

async function seedBookingsAndReviews(categoryBySlug: Map<string, number>) {
  let dayOffset = 5;

  for (const def of PROVIDER_DEFS) {
    const categoryId = categoryBySlug.get(def.categorySlugs[0] ?? "");
    if (categoryId === undefined) continue;

    for (let i = 0; i < def.reviewCount; i++) {
      const customer = pickCustomer(i);
      dayOffset += 3;

      const startAt = new Date();
      startAt.setDate(startAt.getDate() - dayOffset);
      startAt.setHours(9 + i, 0, 0, 0);
      const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

      const rating = 3 + (i % 3);
      const bookingId = seedUuid(`booking:${def.id}:${i}`);

      const booking = await db.booking.upsert({
        where: { id: bookingId },
        create: {
          id: bookingId,
          customerId: customer.id,
          providerId: def.id,
          categoryId,
          status: "completed",
          startAt,
          endAt,
          description: `ขอความช่วยเหลือเรื่อง${def.displayName} นัดหมายล่วงหน้าตามตารางที่ว่าง`,
          address: `123/${i + 1} หมู่บ้านตัวอย่าง ${def.areaLabel}`,
          confirmedAt: startAt,
          startedAt: startAt,
          completedAt: endAt,
        },
        update: {},
        select: { id: true },
      });

      await db.review.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          customerId: customer.id,
          providerId: def.id,
          rating,
          comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
        },
        update: {},
      });
    }
  }
}

async function main() {
  // Seeded accounts have well-known passwords (including an admin), and
  // email/password login is enabled in production -- never create them there.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production. Seed data is for dev/staging only.");
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);

  const categoryRows = await seedCategories();
  const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  await seedAdmin();
  await seedCustomers(passwordHash);
  await seedProviders(passwordHash, categoryBySlug);
  await seedBookingsAndReviews(categoryBySlug);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
