import { slugify } from "@/lib/utils/slug";

export function slugifyKnowledgeTitle(title: string): string {
  const slug = slugify(title);
  return slug === "workspace" ? "article" : slug;
}
