function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  );
}

/** Strip markdown syntax to plain text for excerpts / FTS body_text. */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Escape HTML first, then apply a limited markdown subset.
 * Never passes through raw HTML — XSS-safe for article display.
 */
export function renderSafeMarkdown(md: string): string {
  const escaped = escapeHtml(md ?? "");
  const fences: string[] = [];

  let html = escaped.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_match, _lang, code: string) => {
    const index = fences.length;
    fences.push(`<pre><code>${code.replace(/^\n|\n$/g, "")}</code></pre>`);
    return `\u0000FENCE${index}\u0000`;
  });

  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  html = html.replace(
    /^######\s+(.+)$/gm,
    "<h6>$1</h6>",
  );
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  html = html.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    if (!isSafeHref(href)) {
      return label;
    }
    return `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
  });

  html = html.replace(/^&gt;\s?(.*)$/gm, "<blockquote>$1</blockquote>");

  html = html.replace(/(?:^|\n)((?:[-*+]\s+.+(?:\n|$))+)/g, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^[-*+]\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join("");
    return `\n<ul>${items}</ul>\n`;
  });

  html = html.replace(/(?:^|\n)((?:\d+\.\s+.+(?:\n|$))+)/g, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join("");
    return `\n<ol>${items}</ol>\n`;
  });

  html = html
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("\u0000FENCE")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  html = html.replace(/\u0000FENCE(\d+)\u0000/g, (_match, index: string) => {
    return fences[Number(index)] ?? "";
  });

  return html;
}
