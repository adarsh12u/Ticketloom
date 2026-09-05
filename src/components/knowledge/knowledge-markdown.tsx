import { cn } from "@/lib/utils";

type KnowledgeMarkdownProps = {
  html: string;
  className?: string;
};

/**
 * Renders HTML produced by `renderSafeMarkdown` only.
 * Do not pass unsanitized user HTML.
 */
export function KnowledgeMarkdown({ html, className }: KnowledgeMarkdownProps) {
  return (
    <div
      className={cn(
        "knowledge-prose max-w-none text-sm leading-relaxed text-foreground",
        "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold",
        "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold",
        "[&_p]:mb-3 [&_p]:text-foreground/90",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted/60 [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
