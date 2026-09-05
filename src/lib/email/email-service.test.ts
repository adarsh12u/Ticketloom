import { describe, expect, it } from "vitest";

import { getEmailProviderName } from "@/lib/email/email-service";

describe("email provider selection", () => {
  it("reports a provider name without exposing credentials", () => {
    const name = getEmailProviderName();
    expect(["smtp", "console", "none"]).toContain(name);
  });
});
