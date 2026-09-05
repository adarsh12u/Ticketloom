import { createHash } from "node:crypto";

import { getAiConfig } from "@/lib/ai/config";

export type TextChunk = {
  chunkIndex: number;
  content: string;
  title: string;
  section: string | null;
  contentHash: string;
};

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Deterministic chunking by markdown headings / paragraphs.
 * Target ~800–1200 characters per chunk.
 */
export function chunkArticle(params: {
  title: string;
  body: string;
  minChars?: number;
  maxChars?: number;
}): TextChunk[] {
  const config = getAiConfig();
  const minChars = params.minChars ?? config.minChunkChars;
  const maxChars = params.maxChars ?? config.maxChunkChars;
  const body = params.body.replace(/\r\n/g, "\n").trim();
  if (!body) {
    return [
      {
        chunkIndex: 0,
        content: params.title,
        title: params.title,
        section: null,
        contentHash: hashContent(params.title),
      },
    ];
  }

  const sections = splitByHeadings(body);
  const rawPieces: Array<{ section: string | null; text: string }> = [];

  for (const section of sections) {
    const paragraphs = section.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) continue;

    let buffer = "";
    for (const paragraph of paragraphs) {
      if (!buffer) {
        buffer = paragraph;
        continue;
      }
      if (buffer.length + 2 + paragraph.length <= maxChars) {
        buffer = `${buffer}\n\n${paragraph}`;
      } else {
        rawPieces.push({ section: section.heading, text: buffer });
        buffer = paragraph;
      }
    }
    if (buffer) {
      rawPieces.push({ section: section.heading, text: buffer });
    }
  }

  // Merge undersized trailing pieces with previous when possible
  const merged: Array<{ section: string | null; text: string }> = [];
  for (const piece of rawPieces) {
    const last = merged[merged.length - 1];
    if (last && last.text.length < minChars && last.text.length + 2 + piece.text.length <= maxChars) {
      last.text = `${last.text}\n\n${piece.text}`;
      if (!last.section && piece.section) last.section = piece.section;
    } else if (piece.text.length > maxChars) {
      for (const slice of hardSplit(piece.text, maxChars)) {
        merged.push({ section: piece.section, text: slice });
      }
    } else {
      merged.push({ ...piece });
    }
  }

  return merged.map((piece, chunkIndex) => {
    const content = `${params.title}\n\n${piece.text}`.trim();
    return {
      chunkIndex,
      content,
      title: params.title,
      section: piece.section,
      contentHash: hashContent(content),
    };
  });
}

function splitByHeadings(body: string): Array<{ heading: string | null; text: string }> {
  const lines = body.split("\n");
  const sections: Array<{ heading: string | null; text: string }> = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) sections.push({ heading: currentHeading, text });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2]!.trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0) {
    return [{ heading: null, text: body }];
  }
  return sections;
}

function hardSplit(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
