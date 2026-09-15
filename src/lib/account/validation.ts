import { z } from "zod";

/** Matches the floor the admin console enforces. */
export const MIN_PASSWORD_LENGTH = 12;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(200, "Password is too long."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "The new password must be different from the current one.",
    path: ["newPassword"],
  });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
