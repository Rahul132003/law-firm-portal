import { z } from "zod";

/**
 * Input validation for every case mutation.
 *
 * Server Actions accept whatever the client sends, so nothing reaches Prisma
 * without passing through here first.
 */

const CASE_TYPES = ["CIVIL", "CRIMINAL", "CORPORATE", "FAMILY"] as const;
const CASE_STATUSES = [
  "FILED",
  "UNDER_TRIAL",
  "JUDGMENT",
  "APPEAL",
  "CLOSED",
] as const;
const CASE_ROLES = [
  "LEAD_COUNSEL",
  "CO_COUNSEL",
  "SUPPORTING_ADVOCATE",
  "PARALEGAL",
] as const;

/** Trims, then treats an empty string as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const caseInputSchema = z.object({
  caseNumber: requiredText("Case number", 64),
  title: requiredText("Title", 200),
  clientName: requiredText("Client name", 160),
  caseType: z.enum(CASE_TYPES, { message: "Choose a case type." }),
  court: requiredText("Court", 160),
  jurisdiction: requiredText("Jurisdiction", 160),
  judge: optionalText(160),
  opposingParty: optionalText(200),
  opposingCounsel: optionalText(200),
  status: z.enum(CASE_STATUSES, { message: "Choose a status." }),
  filedOn: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || !Number.isNaN(Date.parse(value)),
      "Filing date is not a valid date.",
    )
    .transform((value) => (value === null ? null : new Date(value))),
  assignments: z
    .array(
      z.object({
        userId: z.string().min(1),
        roleOnCase: z.enum(CASE_ROLES),
      }),
    )
    .max(50, "That is too many people for one case."),
});

export type CaseInput = z.infer<typeof caseInputSchema>;

export const statusChangeSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(CASE_STATUSES),
});

export const noteInputSchema = z.object({
  caseId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "A note cannot be empty.")
    .max(20_000, "Note is too long."),
  visibility: z.enum(["CASE_TEAM", "STRATEGY"]),
});

/**
 * Pulls the repeated `assignment` fields out of FormData. Each entry is * encoded as `userId:roleOnCase` by the assignment editor.
 */
export function parseAssignments(
  formData: FormData,
): Array<{ userId: string; roleOnCase: string }> {
  return formData
    .getAll("assignment")
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      const separator = value.lastIndexOf(":");
      return {
        userId: value.slice(0, separator),
        roleOnCase: value.slice(separator + 1),
      };
    })
    .filter((entry) => entry.userId !== "");
}

/**
 * Flattens Zod issues into `{ fieldName: firstMessage }`, which is what the * forms render. Zod 4 removed `.flatten()`, so this walks `issues` directly.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
