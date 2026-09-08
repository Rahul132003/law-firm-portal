import { z } from "zod";

export const noticeInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A title is required.")
    .max(160, "Title must be 160 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(1, "A notice needs a body.")
    .max(20_000, "Notice is too long."),
  isPinned: z.boolean(),
});

export type NoticeInput = z.infer<typeof noticeInputSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
