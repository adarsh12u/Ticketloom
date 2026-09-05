import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJsonText, parseJsonWithSchema } from "@/lib/ai/parse-json";

describe("parse-json", () => {
  it("extracts raw JSON objects", () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it("extracts fenced JSON", () => {
    const raw = "Here you go:\n```json\n{\"ok\":true}\n```\n";
    expect(extractJsonText(raw)).toBe('{"ok":true}');
  });

  it("validates with zod", () => {
    const schema = z.object({ summary: z.string() });
    const parsed = parseJsonWithSchema('{"summary":"hello"}', schema);
    expect(parsed.summary).toBe("hello");
  });

  it("throws on missing JSON", () => {
    expect(() => extractJsonText("no json here")).toThrow(/No JSON/);
  });
});
