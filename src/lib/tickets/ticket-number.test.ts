import { describe, expect, it } from "vitest";

import { formatTicketNumber, parseTicketNumberKey } from "@/lib/tickets/ticket-number";
import {
  createTicketSchema,
  listTicketsSchema,
} from "@/lib/validations/ticket";

describe("ticket number helpers", () => {
  it("formats human-friendly ticket references", () => {
    expect(formatTicketNumber(1)).toBe("TKT-000001");
    expect(formatTicketNumber(42)).toBe("TKT-000042");
    expect(formatTicketNumber(123456)).toBe("TKT-123456");
  });

  it("parses ticket number keys", () => {
    expect(parseTicketNumberKey("tkt-12")).toBe("TKT-000012");
    expect(parseTicketNumberKey("bad")).toBeNull();
  });
});

describe("ticket validation", () => {
  it("requires customer identity on create", () => {
    expect(
      createTicketSchema.safeParse({
        subject: "Help needed",
        description: "Something broke",
      }).success,
    ).toBe(false);

    expect(
      createTicketSchema.safeParse({
        subject: "Help needed",
        description: "Something broke",
        customer: { name: "Ada", email: "ada@example.com" },
      }).success,
    ).toBe(true);
  });

  it("parses list query defaults", () => {
    const parsed = listTicketsSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.sortBy).toBe("createdAt");
    expect(parsed.sortDir).toBe("desc");
  });
});
