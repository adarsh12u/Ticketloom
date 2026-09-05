import type { GenerateMessage } from "@/lib/ai/types";

export function buildTicketSummaryMessages(ticketContext: string): GenerateMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a support assistant for Ticketloom.",
        "Summarize the ticket for an agent. Use only the untrusted reference material.",
        "Do not invent facts. Respond with JSON only matching:",
        '{"summary":"...","customerIssue":"...","currentStatus":"...","nextSteps":["..."]}',
      ].join(" "),
    },
    {
      role: "user",
      content: `Create a ticket summary.\n\n${ticketContext}`,
    },
  ];
}
