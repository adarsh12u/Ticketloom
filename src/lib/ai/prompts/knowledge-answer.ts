import type { GenerateMessage } from "@/lib/ai/types";

export function buildKnowledgeAnswerMessages(params: {
  query: string;
  knowledgeContext: string;
}): GenerateMessage[] {
  return [
    {
      role: "system",
      content: [
        "You answer agent questions using knowledge base excerpts only.",
        "If excerpts are insufficient, say so clearly.",
        "Respond with JSON only matching:",
        '{"answer":"...","citations":[{"title":"...","relevance":"..."}],"confidence":"low|medium|high"}',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Agent question:\n${params.query}`,
        `Knowledge RAG excerpts:\n${params.knowledgeContext}`,
      ].join("\n\n"),
    },
  ];
}
