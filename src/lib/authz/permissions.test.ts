import { describe, expect, it } from "vitest";

import {
  canManageMembers,
  getPermissionsForRole,
  normalizeRole,
  roleHasPermission,
} from "@/lib/authz/permissions";
import {
  createOrganizationSchema,
  inviteMemberSchema,
  organizationSlugSchema,
} from "@/lib/validations/organization";

describe("RBAC permissions", () => {
  it("grants OWNER full catalog including organization.delete", () => {
    const permissions = getPermissionsForRole("OWNER");
    expect(permissions).toContain("organization.delete");
    expect(permissions).toContain("members.invite");
    expect(permissions).toContain("tickets.assign");
    expect(permissions).toContain("analytics.read");
  });

  it("grants ADMIN management permissions without organization.delete", () => {
    expect(roleHasPermission("ADMIN", "members.invite")).toBe(true);
    expect(roleHasPermission("ADMIN", "organization.update")).toBe(true);
    expect(roleHasPermission("ADMIN", "organization.delete")).toBe(false);
  });

  it("limits AGENT to operational write permissions", () => {
    expect(roleHasPermission("AGENT", "tickets.create")).toBe(true);
    expect(roleHasPermission("AGENT", "chat.update")).toBe(true);
    expect(roleHasPermission("AGENT", "knowledge.create")).toBe(true);
    expect(roleHasPermission("AGENT", "knowledge.publish")).toBe(false);
    expect(roleHasPermission("AGENT", "members.invite")).toBe(false);
    expect(roleHasPermission("AGENT", "organization.update")).toBe(false);
    expect(canManageMembers("AGENT")).toBe(false);
  });

  it("limits VIEWER to read permissions", () => {
    expect(roleHasPermission("VIEWER", "tickets.read")).toBe(true);
    expect(roleHasPermission("VIEWER", "chat.read")).toBe(true);
    expect(roleHasPermission("VIEWER", "knowledge.read")).toBe(true);
    expect(roleHasPermission("VIEWER", "knowledge.update")).toBe(false);
    expect(roleHasPermission("VIEWER", "chat.update")).toBe(false);
    expect(roleHasPermission("VIEWER", "tickets.create")).toBe(false);
    expect(roleHasPermission("VIEWER", "members.update")).toBe(false);
    expect(roleHasPermission("VIEWER", "ai.use")).toBe(false);
    expect(canManageMembers("VIEWER")).toBe(false);
  });

  it("grants ai.use to AGENT OWNER and ADMIN but not VIEWER", () => {
    expect(roleHasPermission("AGENT", "ai.use")).toBe(true);
    expect(roleHasPermission("OWNER", "ai.use")).toBe(true);
    expect(roleHasPermission("ADMIN", "ai.use")).toBe(true);
    expect(roleHasPermission("VIEWER", "ai.use")).toBe(false);
    expect(roleHasPermission("CUSTOMER", "ai.use")).toBe(false);
  });

  it("grants ADMIN knowledge publish and manage", () => {
    expect(roleHasPermission("ADMIN", "knowledge.publish")).toBe(true);
    expect(roleHasPermission("ADMIN", "knowledge.manage")).toBe(true);
    expect(roleHasPermission("ADMIN", "knowledge.archive")).toBe(true);
  });

  it("maps legacy MANAGER/CUSTOMER roles", () => {
    expect(normalizeRole("MANAGER")).toBe("ADMIN");
    expect(normalizeRole("CUSTOMER")).toBe("VIEWER");
    expect(roleHasPermission("MANAGER", "members.invite")).toBe(true);
    expect(roleHasPermission("CUSTOMER", "tickets.read")).toBe(true);
    expect(roleHasPermission("CUSTOMER", "tickets.create")).toBe(false);
  });
});

describe("organization validation", () => {
  it("accepts valid organization payloads and URL-safe slugs", () => {
    expect(
      createOrganizationSchema.safeParse({ name: "Acme Support", slug: "acme-support" })
        .success,
    ).toBe(true);
    expect(organizationSlugSchema.safeParse("Acme Support").success).toBe(false);
    expect(organizationSlugSchema.safeParse("acme--support").success).toBe(false);
  });

  it("validates invitation payloads", () => {
    expect(
      inviteMemberSchema.safeParse({ email: "agent@example.com", role: "AGENT" }).success,
    ).toBe(true);
    expect(
      inviteMemberSchema.safeParse({ email: "bad", role: "OWNER" }).success,
    ).toBe(false);
  });
});
