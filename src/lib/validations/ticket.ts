import { z } from "zod";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TICKET_TYPES = [
  "QUESTION",
  "INCIDENT",
  "PROBLEM",
  "FEATURE_REQUEST",
  "OTHER",
] as const;

export const TICKET_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "priority",
  "status",
  "number",
  "dueAt",
] as const;

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email("Enter a valid customer email"),
  company: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  description: z.string().trim().min(1, "Description is required").max(20_000),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  customerId: z.string().min(1).optional(),
  customer: customerInputSchema.optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  teamId: z.string().min(1).optional().nullable(),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  dueAt: z.coerce.date().optional().nullable(),
  firstResponseDueAt: z.coerce.date().optional().nullable(),
  resolutionDueAt: z.coerce.date().optional().nullable(),
}).refine((data) => Boolean(data.customerId || data.customer), {
  message: "Provide customerId or customer details.",
  path: ["customer"],
});

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(1).max(20_000).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  customerId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  teamId: z.string().min(1).optional().nullable(),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  dueAt: z.coerce.date().optional().nullable(),
  firstResponseDueAt: z.coerce.date().optional().nullable(),
  resolutionDueAt: z.coerce.date().optional().nullable(),
});

export const listTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  includeArchived: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  sortBy: z.enum(TICKET_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const createTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  visibility: z.enum(["INTERNAL", "CUSTOMER"]),
});

export const createCustomerSchema = customerInputSchema;

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().max(30).optional().nullable(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsInput = z.infer<typeof listTicketsSchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
