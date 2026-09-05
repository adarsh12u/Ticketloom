import { z } from "zod";

/**
 * Extract JSON from model output (raw object or fenced ```json blocks).
 */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("No JSON object found in model output.");
}

export function parseJsonWithSchema<T>(raw: string, schema: z.ZodType<T>): T {
  const jsonText = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Model output was not valid JSON.");
  }
  return schema.parse(parsed);
}
