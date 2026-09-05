import type { GenerateMessage } from "@/lib/ai/types";

export function buildReplySuggestionMessages(params: {
  context: string;
  knowledgeContext?: string;
}): GenerateMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a support assistant drafting a reply for a human agent.",
        "Never send messages yourself — produce a draft only.",
        "Be professional, empathetic, and accurate. Use only provided references.",
        "If knowledge excerpts are present, prefer them over guessing.",
        "Respond with JSON only matching:",
        '{"reply":"...","rationale":"..."}',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Draft a customer-facing reply.",
        params.context,
        params.knowledgeContext
          ? `\nKnowledge excerpts for RAG:\n${params.knowledgeContext}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
