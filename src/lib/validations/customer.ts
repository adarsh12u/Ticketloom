import { z } from "zod";

export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE", "PROSPECT", "ARCHIVED"] as const;

export const CUSTOMER_SORT_OPTIONS = [
  "newest",
  "oldest",
  "recently_active",
  "alphabetical",
] as const;

export function buildCustomerDisplayName(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}) {
  const fromParts = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  if (input.name?.trim()) return input.name.trim();
  return input.email?.trim() || "Customer";
}

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    firstName: z.string().trim().max(80).optional().nullable(),
    lastName: z.string().trim().max(80).optional().nullable(),
    email: z.email("Enter a valid customer email"),
    phone: z.string().trim().max(40).optional().nullable(),
    company: z.string().trim().max(120).optional().nullable(),
    jobTitle: z.string().trim().max(120).optional().nullable(),
    image: z
      .union([z.literal(""), z.url()])
      .optional()
      .nullable(),
    status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
    source: z.string().trim().max(80).optional().nullable(),
    profileNotes: z.string().trim().max(10_000).optional().nullable(),
    tagIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine((data) => Boolean(data.name || data.firstName || data.lastName), {
    message: "Provide a name or first/last name.",
    path: ["name"],
  });

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  email: z.email("Enter a valid customer email").optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  image: z.union([z.literal(""), z.url()]).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
  source: z.string().trim().max(80).optional().nullable(),
  profileNotes: z.string().trim().max(10_000).optional().nullable(),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
});

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  company: z.string().trim().max(120).optional(),
  tagId: z.string().min(1).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  includeArchived: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  sort: z.enum(CUSTOMER_SORT_OPTIONS).default("newest"),
});

export const createCustomerNoteSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
