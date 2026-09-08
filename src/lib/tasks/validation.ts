import { z } from "zod";
const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const KINDS = ["GENERAL", "FILING_DEADLINE", "LIMITATION_DEADLINE"] as const;

export const taskInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Describe what needs doing.")
    .max(2000, "Description is too long."),
  assignedToId: z.string().trim().min(1, "Choose who this is for."),
  // Empty string means a personal task with no case attached.
  caseId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  dueDate: z
    .string()
    .trim()
    .min(1, "A due date is required.")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Due date is not a valid date.",
    )
    .transform((value) => new Date(value)),
  status: z.enum(STATUSES, { message: "Choose a status." }),
  kind: z.enum(KINDS, { message: "Choose a task type." }),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const statusChangeSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(STATUSES),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
