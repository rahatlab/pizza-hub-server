import { z } from "zod";

/**
 * Assignment rule: minimum 6 characters with at least one uppercase and
 * one lowercase letter. Validated here so both sign-up and password
 * changes behave identically, and the error text stays user-facing.
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter")
  .regex(/[a-z]/, "Password needs at least one lowercase letter");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be 80 characters or fewer");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email must be 254 characters or fewer");

/**
 * `vendor` is allowed here because a pizzeria owner signs themselves up.
 * `admin` is deliberately absent — admin accounts come from the seed
 * script only, never from a public endpoint.
 */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["customer", "vendor"]).default("customer"),
  businessName: z.string().trim().max(120).optional(),
  businessLocation: z.string().trim().max(160).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rule on sign-in — the account already exists.
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
