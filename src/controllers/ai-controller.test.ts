import { describe, expect, it } from "vitest";

import { AI_UNAVAILABLE } from "@/lib/ai/types";

/**
 * Keep this mapping in sync with `aiErrorHttpStatus` in ai-controller.ts.
 * This file avoids importing Next.js / Auth.js modules into Vitest.
 */
function aiErrorHttpStatus(
  code:
    | "NOT_FOUND"
    | "VALIDATION"
    | "FORBIDDEN"
    | "RATE_LIMITED"
    | typeof AI_UNAVAILABLE
    | "FAILURE",
): number {
  const statusMap = {
    NOT_FOUND: 404,
    VALIDATION: 400,
    FORBIDDEN: 403,
    RATE_LIMITED: 429,
    [AI_UNAVAILABLE]: 503,
    FAILURE: 502,
  } as const;
  return statusMap[code] ?? 400;
}

describe("AI HTTP error mapping", () => {
  it("maps AI_UNAVAILABLE to 503", () => {
    expect(aiErrorHttpStatus(AI_UNAVAILABLE)).toBe(503);
  });

  it("maps FAILURE to 502", () => {
    expect(aiErrorHttpStatus("FAILURE")).toBe(502);
  });

  it("maps RATE_LIMITED to 429", () => {
    expect(aiErrorHttpStatus("RATE_LIMITED")).toBe(429);
  });
});
