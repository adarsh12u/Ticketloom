import { describe, expect, it } from "vitest";

import { assertSocketPermission, type SocketAuthContext } from "@/socket/auth";

describe("socket auth helpers", () => {
  const base: SocketAuthContext = {
    userId: "user-1",
    email: "agent@example.com",
    organizationId: "org-1",
    role: "AGENT",
  };

  it("allows AGENT chat.update", async () => {
    await expect(assertSocketPermission(base, "chat.update")).resolves.toBeUndefined();
  });

  it("denies VIEWER chat.update", async () => {
    await expect(
      assertSocketPermission({ ...base, role: "VIEWER" }, "chat.update"),
    ).rejects.toMatchObject({ name: "SocketAuthError" });
  });

  it("denies VIEWER ai.use", async () => {
    await expect(
      assertSocketPermission({ ...base, role: "VIEWER" }, "ai.use"),
    ).rejects.toMatchObject({ name: "SocketAuthError" });
  });
});
