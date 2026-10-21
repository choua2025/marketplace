import { z } from "zod";

export const priceUnitSchema = z.enum(["job", "hour", "day"]);

export const updateProviderProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    bio: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : undefined)),
    basePrice: z.coerce.number().min(0),
    priceUnit: priceUnitSchema,
    areaLabel: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v ? v : undefined)),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    serviceRadiusKm: z.coerce.number().int().min(1).max(200),
    isActive: z.boolean(),
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: "latitude and longitude must be set together",
    path: ["latitude"],
  })
  .refine((data) => !data.isActive || data.latitude !== undefined, {
    message: "Set a location before going active.",
    path: ["isActive"],
  });

export type UpdateProviderProfileInput = z.infer<typeof updateProviderProfileSchema>;

export const setProviderCategoriesSchema = z.object({
  categorySlugs: z.array(z.string().min(1)).min(1).max(10),
});

export type SetProviderCategoriesInput = z.infer<typeof setProviderCategoriesSchema>;

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
  message: "Expected HH:MM or HH:MM:SS",
});

export const availabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const setAvailabilityRulesSchema = z.object({
  rules: z.array(availabilityRuleSchema).max(28),
});

export type SetAvailabilityRulesInput = z.infer<typeof setAvailabilityRulesSchema>;
