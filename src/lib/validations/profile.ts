import { z } from "zod";

// Same rule as the profile_contacts_phone_format DB constraint.
export const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 100;
export const LINE_ID_MAX = 50;

/** Spaces and dashes are accepted on input ("081-234 5678") and stripped before storage. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export const updatePersonalInfoSchema = z.object({
  fullName: z.string().trim().min(FULL_NAME_MIN).max(FULL_NAME_MAX),
  // Empty string clears the field.
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => v === "" || PHONE_PATTERN.test(v), { message: "Invalid phone number." }),
  lineId: z.string().trim().max(LINE_ID_MAX),
});

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;
