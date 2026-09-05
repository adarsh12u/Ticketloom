import { z } from "zod";

import { ASSIGNABLE_ROLES, MEMBER_ROLES } from "@/lib/authz/permissions";

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Organization name must be at least 2 characters")
  .max(100, "Organization name is too long");

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-safe (lowercase letters, numbers, hyphens)");

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema.optional(),
});

export const updateOrganizationSchema = z.object({
  name: organizationNameSchema.optional(),
  slug: organizationSlugSchema.optional(),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(ASSIGNABLE_ROLES).default("AGENT"),
});

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(MEMBER_ROLES),
});

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;