import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const roleEnum = pgEnum("role", ["customer", "provider", "admin"]);
export const localeEnum = pgEnum("locale", ["th", "en"]);
export const priceUnitEnum = pgEnum("price_unit", ["job", "hour", "day"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);
export const cancelledByEnum = pgEnum("cancelled_by", ["customer", "provider"]);

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("customer"),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  avatarKey: text("avatar_key"),
  locale: localeEnum("locale").notNull().default("th"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profileContacts = pgTable(
  "profile_contacts",
  {
    id: text("id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 20 }),
    lineId: varchar("line_id", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("profile_contacts_phone_format", sql`${table.phone} ~ '^\\+?[0-9]{8,15}$'`)],
);

export const categories = pgTable(
  "categories",
  {
    id: smallint("id").primaryKey().generatedByDefaultAsIdentity(),
    slug: varchar("slug", { length: 40 }).notNull().unique(),
    nameTh: varchar("name_th", { length: 100 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [check("categories_slug_format", sql`${table.slug} ~ '^[a-z0-9-]{2,40}$'`)],
);

export const providerProfiles = pgTable(
  "provider_profiles",
  {
    id: text("id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    bio: varchar("bio", { length: 2000 }),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
    priceUnit: priceUnitEnum("price_unit").notNull().default("job"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    areaLabel: varchar("area_label", { length: 200 }),
    serviceRadiusKm: integer("service_radius_km").notNull().default(10),
    timezone: varchar("timezone", { length: 50 }).notNull().default("Asia/Bangkok"),
    isActive: boolean("is_active").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    completedJobs: integer("completed_jobs").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("provider_profiles_display_name_length", sql`char_length(${table.displayName}) >= 2`),
    check("provider_profiles_base_price_nonnegative", sql`${table.basePrice} >= 0`),
    check(
      "provider_profiles_service_radius_range",
      sql`${table.serviceRadiusKm} between 1 and 200`,
    ),
    check(
      "provider_profiles_lat_lng_both_or_neither",
      sql`(${table.latitude} is null) = (${table.longitude} is null)`,
    ),
    check(
      "provider_profiles_active_requires_location",
      sql`(not ${table.isActive}) or (${table.latitude} is not null)`,
    ),
  ],
);

export const providerCategories = pgTable(
  "provider_categories",
  {
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "cascade" }),
    categoryId: smallint("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.providerId, table.categoryId] })],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "cascade" }),
    imageKey: text("image_key").notNull(),
    caption: varchar("caption", { length: 200 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("portfolio_items_provider_image_unique").on(table.providerId, table.imageKey)],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("availability_rules_provider_weekday_start_unique").on(
      table.providerId,
      table.weekday,
      table.startTime,
    ),
    check("availability_rules_weekday_range", sql`${table.weekday} between 0 and 6`),
    check("availability_rules_end_after_start", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: text("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "restrict" }),
    categoryId: smallint("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    description: varchar("description", { length: 2000 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    photoKeys: text("photo_keys").array().notNull().default([]),
    cancelledBy: cancelledByEnum("cancelled_by"),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("bookings_customer_not_provider", sql`${table.customerId} <> ${table.providerId}`),
    check(
      "bookings_duration",
      sql`${table.endAt} > ${table.startAt} and ${table.endAt} - ${table.startAt} <= interval '12 hours'`,
    ),
    check(
      "bookings_description_length",
      sql`char_length(${table.description}) between 10 and 2000`,
    ),
    check("bookings_address_length", sql`char_length(${table.address}) between 5 and 300`),
    check(
      "bookings_photo_keys_max",
      sql`array_length(${table.photoKeys}, 1) is null or array_length(${table.photoKeys}, 1) <= 5`,
    ),
    check(
      "bookings_cancel_reason_required",
      sql`${table.status} <> 'cancelled' or ${table.cancelReason} is not null`,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: text("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("conversations_customer_provider_unique").on(table.customerId, table.providerId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 2000 }),
    imageKey: text("image_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "messages_body_or_image_required",
      sql`${table.body} is not null or ${table.imageKey} is not null`,
    ),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerProfiles.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: varchar("comment", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("reviews_rating_range", sql`${table.rating} between 1 and 5`)],
);
