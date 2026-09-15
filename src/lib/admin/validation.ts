import { z } from "zod";

const ROLES = [
  "ADMIN_PARTNER",
  "SENIOR_ADVOCATE",
  "ASSOCIATE",
  "PARALEGAL",
] as const;

/** Long enough to matter, short enough that nobody writes it on a sticky note. */
export const MIN_PASSWORD_LENGTH = 12;

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(160, "Email is too long."),
  role: z.enum(ROLES, { message: "Choose a role." }),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
    .max(200, "Password is too long."),
  supervisorId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  role: z.enum(ROLES, { message: "Choose a role." }),
  supervisorId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  isActive: z.boolean(),
});

export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
    .max(200),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
