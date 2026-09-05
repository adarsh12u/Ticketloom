import type { MembershipRole } from "@/generated/prisma/client";

/**
 * Permission catalog for Ticketloom RBAC.
 * Future modules (tickets, customers, knowledge, analytics) check these keys.
 */
export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.delete",
  "members.read",
  "members.invite",
  "members.update",
  "members.remove",
  "tickets.read",
  "tickets.create",
  "tickets.update",
  "tickets.delete",
  "tickets.assign",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
  "knowledge.read",
  "knowledge.create",
  "knowledge.update",
  "knowledge.delete",
  "knowledge.review",
  "knowledge.publish",
  "knowledge.archive",
  "knowledge.manage",
  "analytics.read",
  "ai.use",
  "chat.read",
  "chat.create",
  "chat.update",
  "chat.assign",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS] as Permission[];

const READ_PERMISSIONS: Permission[] = [
  "organization.read",
  "members.read",
  "tickets.read",
  "customers.read",
  "knowledge.read",
  "analytics.read",
  "chat.read",
];

const AGENT_PERMISSIONS: Permission[] = [
  ...READ_PERMISSIONS,
  "tickets.create",
  "tickets.update",
  "tickets.assign",
  "customers.create",
  "customers.update",
  "knowledge.create",
  "knowledge.update",
  "ai.use",
  "chat.create",
  "chat.update",
  "chat.assign",
];

const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (permission) => permission !== "organization.delete",
);

/**
 * Role → permission map.
 * MANAGER maps like ADMIN (legacy M2).
 * CUSTOMER maps like VIEWER (legacy M2).
 *
 * Knowledge:
 * - VIEWER: read published
 * - AGENT: create/edit drafts, submit for review
 * - ADMIN/OWNER: review, publish, archive, manage categories/tags
 */
export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  MANAGER: ADMIN_PERMISSIONS,
  AGENT: AGENT_PERMISSIONS,
  VIEWER: READ_PERMISSIONS,
  CUSTOMER: READ_PERMISSIONS,
};

/** Roles that can be assigned via invite / role change (not OWNER via invite). */
export const ASSIGNABLE_ROLES = ["ADMIN", "AGENT", "VIEWER"] as const;

/** Roles allowed when updating an existing membership (includes OWNER for transfer). */
export const MEMBER_ROLES = ["OWNER", "ADMIN", "AGENT", "VIEWER"] as const;

export function normalizeRole(role: MembershipRole): MembershipRole {
  if (role === "MANAGER") return "ADMIN";
  if (role === "CUSTOMER") return "VIEWER";
  return role;
}

export function getPermissionsForRole(role: MembershipRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? READ_PERMISSIONS;
}

export function roleHasPermission(role: MembershipRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function canManageMembers(role: MembershipRole): boolean {
  return roleHasPermission(role, "members.invite");
}
