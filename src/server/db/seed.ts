import { createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "./client";
import {
  account,
  availabilityRules,
  bookings,
  categories,
  portfolioItems,
  profileContacts,
  profiles,
  providerCategories,
  providerProfiles,
  reviews,
  user,
} from "./schema";

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
  { id: "seed_customer_1", email: "customer1@changdee.test", fullName: "สมหญิง ใจดี" },
  { id: "seed_customer_2", email: "customer2@changdee.test", fullName: "วิชัย รักเรียน" },
] as const;

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

const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: "seed_provider_1",
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
    id: "seed_provider_2",
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
    id: "seed_provider_3",
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
    id: "seed_provider_4",
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
    reviewCount: 1,
  },
  {
    id: "seed_provider_5",
    email: "provider5@changdee.test",
    displayName: "ภาพสวยโฟโต้สตูดิโอ",
    bio: "รับถ่ายภาพพอร์ตเทรต สินค้า และงานอีเวนต์ สไตล์ธรรมชาติ แต่งภาพให้ฟรีทุกงาน",
    categorySlugs: ["photographer"],
    basePrice: "3500.00",
    priceUnit: "job",
    latitude: "13.730700",
    longitude: "100.582600",
    areaLabel: "ทองหล่อ, กรุงเทพฯ",
    isVerified: true,
    reviewCount: 4,
  },
  {
    id: "seed_provider_6",
    email: "provider6@changdee.test",
    displayName: "กราฟิกดีไซน์ครีเอทีฟ",
    bio: "ออกแบบโลโก้ แบรนด์ดิ้ง สื่อสิ่งพิมพ์ และโซเชียลมีเดีย งานสร้างสรรค์ ส่งตรงเวลา",
    categorySlugs: ["graphic-design"],
    basePrice: "8000.00",
    priceUnit: "job",
    latitude: "13.769600",
    longitude: "100.564900",
    areaLabel: "รัชดาภิเษก, กรุงเทพฯ",
    isVerified: false,
    reviewCount: 2,
  },
  {
    id: "seed_provider_7",
    email: "provider7@changdee.test",
    displayName: "ช่างแอร์ & ไฟฟ้า บ้านสุข",
    bio: "บริการครบวงจรเรื่องแอร์และไฟฟ้าในบ้าน ล้างแอร์ ซ่อมแอร์ เดินสายไฟ แก้ไฟดับ",
    categorySlugs: ["air-conditioner", "electrician"],
    basePrice: "900.00",
    priceUnit: "job",
    latitude: "14.020800",
    longitude: "100.525000",
    areaLabel: "เมืองปทุมธานี, ปทุมธานี",
    isVerified: true,
    reviewCount: 4,
  },
  {
    id: "seed_provider_8",
    email: "provider8@changdee.test",
    displayName: "ประปา-ไฟฟ้า ซ่อมด่วน",
    bio: "รับงานซ่อมประปาและไฟฟ้าในบ้าน พื้นที่สมุทรปราการและใกล้เคียง เดินทางไว ราคาชัดเจน",
    categorySlugs: ["plumber", "electrician"],
    basePrice: "450.00",
    priceUnit: "job",
    latitude: "13.599100",
    longitude: "100.599800",
    areaLabel: "เมืองสมุทรปราการ, สมุทรปราการ",
    isVerified: false,
    reviewCount: 1,
  },
  {
    id: "seed_provider_9",
    email: "provider9@changdee.test",
    displayName: "ทำความสะอาดบ้านและคอนโด ใสสะอาด",
    bio: "ทำความสะอาดบ้านหลังย้ายเข้า-ย้ายออก ทำความสะอาดประจำสัปดาห์ บริการพื้นที่นครปฐม",
    categorySlugs: ["cleaning"],
    basePrice: "300.00",
    priceUnit: "hour",
    latitude: "13.819600",
    longitude: "100.064500",
    areaLabel: "เมืองนครปฐม, นครปฐม",
    isVerified: false,
    reviewCount: 2,
  },
  {
    id: "seed_provider_10",
    email: "provider10@changdee.test",
    displayName: "ช่างภาพงานแต่ง + กราฟิก สตูดิโอครีเอทีฟ",
    bio: "รับถ่ายภาพงานแต่งงาน พรีเวดดิ้ง และออกแบบการ์ดแต่งงาน ครบจบในที่เดียว",
    categorySlugs: ["photographer", "graphic-design"],
    basePrice: "15000.00",
    priceUnit: "job",
    latitude: "13.547500",
    longitude: "100.274500",
    areaLabel: "เมืองสมุทรสาคร, สมุทรสาคร",
    isVerified: false,
    reviewCount: 3,
  },
];

const WEEKDAYS_MON_TO_SAT = [1, 2, 3, 4, 5, 6] as const;

// Deterministic (not random) so re-running `pnpm db:seed` hits the same
// primary keys and no-ops via onConflictDoNothing instead of piling up
// duplicate bookings/reviews each run.
function pickCustomer(index: number): (typeof CUSTOMER_DEFS)[number] {
  const customer = CUSTOMER_DEFS[index % CUSTOMER_DEFS.length];
  if (!customer) throw new Error("CUSTOMER_DEFS must not be empty");
  return customer;
}

function deterministicUuid(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function createUserWithCredentials(
  id: string,
  email: string,
  name: string,
  passwordHash: string,
) {
  await db.insert(user).values({ id, name, email, emailVerified: true }).onConflictDoNothing();
  await db
    .insert(account)
    .values({
      id: `${id}_credential`,
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    })
    .onConflictDoNothing();
}

async function seedCategories() {
  for (const def of CATEGORY_DEFS) {
    await db
      .insert(categories)
      .values({
        slug: def.slug,
        nameTh: def.nameTh,
        nameEn: def.nameEn,
        icon: def.icon,
        sortOrder: def.sortOrder,
      })
      .onConflictDoNothing();
  }
  return db.select().from(categories);
}

async function seedCustomers(passwordHash: string) {
  for (const [index, customer] of CUSTOMER_DEFS.entries()) {
    await createUserWithCredentials(customer.id, customer.email, customer.fullName, passwordHash);
    await db
      .insert(profiles)
      .values({ id: customer.id, role: "customer", fullName: customer.fullName })
      .onConflictDoNothing();
    await db
      .insert(profileContacts)
      .values({ id: customer.id, phone: `+6681${String(index).padStart(7, "0")}` })
      .onConflictDoNothing();
  }
}

async function seedProviders(
  passwordHash: string,
  categoryBySlug: Map<string, number>,
): Promise<void> {
  for (const [index, def] of PROVIDER_DEFS.entries()) {
    await createUserWithCredentials(def.id, def.email, def.displayName, passwordHash);
    await db
      .insert(profiles)
      .values({ id: def.id, role: "provider", fullName: def.displayName })
      .onConflictDoNothing();
    await db
      .insert(profileContacts)
      .values({ id: def.id, phone: `+6682${String(index).padStart(7, "0")}` })
      .onConflictDoNothing();
    await db
      .insert(providerProfiles)
      .values({
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
      })
      .onConflictDoNothing();

    for (const slug of def.categorySlugs) {
      const categoryId = categoryBySlug.get(slug);
      if (categoryId === undefined) throw new Error(`Unknown category slug in seed data: ${slug}`);
      await db
        .insert(providerCategories)
        .values({ providerId: def.id, categoryId })
        .onConflictDoNothing();
    }

    for (const weekday of WEEKDAYS_MON_TO_SAT) {
      await db
        .insert(availabilityRules)
        .values({ providerId: def.id, weekday, startTime: "08:00:00", endTime: "18:00:00" })
        .onConflictDoNothing();
    }

    await db
      .insert(portfolioItems)
      .values({
        providerId: def.id,
        imageKey: `portfolio/${def.id}/seed-sample.jpg`,
        caption: `ตัวอย่างผลงานของ ${def.displayName}`,
        sortOrder: 0,
      })
      .onConflictDoNothing();
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

      const [booking] = await db
        .insert(bookings)
        .values({
          id: deterministicUuid(`booking:${def.id}:${i}`),
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
        })
        .onConflictDoNothing()
        .returning({ id: bookings.id });

      if (!booking) continue;

      await db
        .insert(reviews)
        .values({
          bookingId: booking.id,
          customerId: customer.id,
          providerId: def.id,
          rating,
          comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
        })
        .onConflictDoNothing();
    }
  }
}

async function main() {
  const passwordHash = await hashPassword(DEV_PASSWORD);

  const categoryRows = await seedCategories();
  const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

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
