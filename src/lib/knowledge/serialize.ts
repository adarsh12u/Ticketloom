type DateLike = Date | string | null | undefined;

function toIso(value: DateLike): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function serializeNestedDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeNestedDates(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeNestedDates(nested);
    }
    return out as T;
  }
  return value;
}

/** Convert Date fields on knowledge payloads to ISO strings for client components. */
export function serializeKnowledge<T>(value: T): T {
  return serializeNestedDates(value);
}

export function serializeListItem<T extends Record<string, unknown>>(item: T) {
  return {
    ...item,
    publishedAt: toIso(item.publishedAt as DateLike),
    archivedAt: toIso(item.archivedAt as DateLike),
    createdAt: toIso(item.createdAt as DateLike) ?? new Date(0).toISOString(),
    updatedAt: toIso(item.updatedAt as DateLike) ?? new Date(0).toISOString(),
    currentVersion: item.currentVersion
      ? serializeNestedDates(item.currentVersion)
      : item.currentVersion,
    publishedVersion: item.publishedVersion
      ? serializeNestedDates(item.publishedVersion)
      : item.publishedVersion,
    tags: item.tags,
    category: item.category,
    author: item.author,
    owner: item.owner,
    counts: item.counts,
  };
}
