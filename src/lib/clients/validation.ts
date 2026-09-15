import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));

export const clientUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(160, "Name must be 160 characters or fewer."),
  kind: z.enum(["INDIVIDUAL", "ORGANISATION"], { message: "Choose a client type." }),
  email: optionalText(254).refine(
    (value) => value === null || z.email().safeParse(value).success,
    "That is not a valid email address.",
  ),
  phone: optionalText(40),
  address: optionalText(500),
});

export const CLIENT_KIND_LABELS = {
  INDIVIDUAL: "Individual",
  ORGANISATION: "Organisation",
} as const;
