import { describe, expect, it } from "vitest";

import { chunkArticle, hashContent } from "@/lib/ai/chunking";

describe("chunkArticle", () => {
  it("chunks by headings and paragraphs within size bounds", () => {
    const body = [
      "# Getting started",
      "",
      "A".repeat(400),
      "",
      "B".repeat(400),
      "",
      "## Advanced",
      "",
      "C".repeat(500),
      "",
      "D".repeat(500),
    ].join("\n");

    const chunks = chunkArticle({
      title: "Guide",
      body,
      minChars: 800,
      maxChars: 1200,
    });

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.contentHash).toBe(hashContent(chunk.content));
      expect(chunk.title).toBe("Guide");
    }
    expect(chunks.some((c) => c.section === "Getting started" || c.section === "Advanced")).toBe(
      true,
    );
  });

  it("is deterministic for the same input", () => {
    const body = "## One\n\n" + "paragraph ".repeat(80);
    const a = chunkArticle({ title: "T", body });
    const b = chunkArticle({ title: "T", body });
    expect(a).toEqual(b);
  });

  it("handles empty body with title-only chunk", () => {
    const chunks = chunkArticle({ title: "Empty", body: "  " });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("Empty");
  });
});
