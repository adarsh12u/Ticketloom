export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "workspace";
}

export function uniqueSlug(base: string, suffix?: string): string {
  const slug = slugify(base);
  if (!suffix) return slug;
  return `${slug}-${suffix}`.slice(0, 60);
}
