import { z } from "zod";

/**
 * Assignment rule: minimum 6 characters with at least one uppercase and
 * one lowercase letter. Kept here as a plain schema so both the sign-up
 * form validation and any future password change share one definition.
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter")
  .regex(/[a-z]/, "Password needs at least one lowercase letter");

/** Roles that a public sign-up may choose. `admin` is never in this list. */
export const selectableRoles = ["customer", "vendor"] as const;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(400).optional(),
  image: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\//.test(v), "Image must be an https URL")
    .optional(),
  businessName: z.string().trim().max(120).optional(),
  businessLocation: z.string().trim().max(160).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
