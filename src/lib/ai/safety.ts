/**
 * Prompt injection safety helpers.
 * Treat ticket/chat/KB content as untrusted reference material.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?prior\s+instructions/gi,
  /system\s*:\s*/gi,
  /<\s*\/?\s*system\s*>/gi,
];

export function stripInjectionPatterns(text: string): string {
  let result = text;
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, "[filtered]");
  }
  return result;
}

export function delimitUntrusted(
  label: string,
  content: string,
  maxChars?: number,
): string {
  const cleaned = stripInjectionPatterns(content);
  const truncated =
    maxChars && cleaned.length > maxChars
      ? `${cleaned.slice(0, maxChars)}\n…[truncated]`
      : cleaned;
  return [
    `<<<UNTRUSTED_REFERENCE label="${label}">>>`,
    truncated,
    `<<<END_UNTRUSTED_REFERENCE label="${label}">>>`,
  ].join("\n");
}

export function truncateContext(parts: string[], maxChars: number): string {
  const joined = parts.join("\n\n");
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}\n…[context truncated]`;
}
