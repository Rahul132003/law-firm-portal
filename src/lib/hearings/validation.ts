import { z } from "zod";

/** Input validation for hearing create/update. */

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      `${label} is not a valid date.`,
    )
    .transform((value) => new Date(value));

const optionalDateField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || !Number.isNaN(Date.parse(value)),
    "Next hearing date is not a valid date.",
  )
  .transform((value) => (value === null ? null : new Date(value)));

export const hearingInputSchema = z
  .object({
    date: dateField("Hearing date"),
    court: z
      .string()
      .trim()
      .min(1, "Court is required.")
      .max(160, "Court must be 160 characters or fewer."),
    purpose: z
      .string()
      .trim()
      .min(1, "Purpose is required.")
      .max(200, "Purpose must be 200 characters or fewer."),
    notes: z
      .string()
      .trim()
      .max(20_000, "Notes are too long.")
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    nextDate: optionalDateField,
  })
  .refine((value) => value.nextDate === null || value.nextDate > value.date, {
    message: "The next hearing must be after this one.",
    path: ["nextDate"],
  });

export type HearingInput = z.infer<typeof hearingInputSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
