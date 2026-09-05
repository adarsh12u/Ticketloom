import type { GenerateMessage } from "@/lib/ai/types";

export function buildConversationSummaryMessages(
  transcript: string,
): GenerateMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a support assistant for Ticketloom.",
        "Summarize this conversation transcript for an agent.",
        "Use only the untrusted reference material. Do not invent facts.",
        "Respond with JSON only matching:",
        '{"summary":"...","keyPoints":["..."],"openQuestions":["..."]}',
      ].join(" "),
    },
    {
      role: "user",
      content: `Create a conversation summary from the chat transcript.\n\n${transcript}`,
    },
  ];
}
