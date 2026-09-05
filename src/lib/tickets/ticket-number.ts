export function formatTicketNumber(number: number): string {
  return `TKT-${String(number).padStart(6, "0")}`;
}

export function parseTicketNumberKey(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  const match = /^TKT-(\d{1,9})$/.exec(trimmed);
  if (!match) return null;
  return formatTicketNumber(Number(match[1]));
}

/** Default SLA targets in hours by priority (foundation; configurable later). */
export const DEFAULT_SLA_HOURS: Record<
  "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  { firstResponse: number; resolution: number }
> = {
  LOW: { firstResponse: 48, resolution: 168 },
  MEDIUM: { firstResponse: 24, resolution: 72 },
  HIGH: { firstResponse: 8, resolution: 24 },
  URGENT: { firstResponse: 1, resolution: 4 },
};

export function computeSlaDeadlines(
  priority: keyof typeof DEFAULT_SLA_HOURS,
  from = new Date(),
) {
  const hours = DEFAULT_SLA_HOURS[priority];
  return {
    firstResponseDueAt: new Date(from.getTime() + hours.firstResponse * 60 * 60 * 1000),
    resolutionDueAt: new Date(from.getTime() + hours.resolution * 60 * 60 * 1000),
  };
}
