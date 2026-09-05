import type { GenerateMessage } from "@/lib/ai/types";

export type ToneOption = "professional" | "friendly" | "empathetic" | "concise";

export function buildToneTransformMessages(params: {
  text: string;
  tone: ToneOption;
}): GenerateMessage[] {
  return [
    {
      role: "system",
      content: [
        "You rewrite support replies for tone only.",
        "Preserve meaning and factual content. Do not add new claims.",
        "Respond with JSON only matching:",
        '{"rewritten":"..."}',
      ].join(" "),
    },
    {
      role: "user",
      content: `Rewrite the following text in a ${params.tone} tone.\n\n${params.text}`,
    },
  ];
}
