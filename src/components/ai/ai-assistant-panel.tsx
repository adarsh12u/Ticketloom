"use client";

import * as React from "react";
import {
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AiFeature =
  | "TICKET_SUMMARY"
  | "CONVERSATION_SUMMARY"
  | "REPLY_SUGGESTION"
  | "TONE_TRANSFORM"
  | "KNOWLEDGE_SEARCH"
  | "RAG_ANSWER";

type AiAssistantPanelProps = {
  ticketId?: string;
  conversationId?: string;
  canUseAi: boolean;
  className?: string;
  /** Called when user inserts a suggested reply into the composer (never auto-sends). */
  onInsertReply?: (text: string) => void;
  compact?: boolean;
};

type SummaryState = {
  suggestionId: string;
  text: string;
  meta?: string[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      typeof data.error === "string" ? data.error : "Request failed",
    ) as Error & { code?: string };
    error.code = data.code;
    throw error;
  }
  return data as T;
}

export function AiAssistantPanel({
  ticketId,
  conversationId,
  canUseAi,
  className,
  onInsertReply,
  compact = false,
}: AiAssistantPanelProps) {
  const [status, setStatus] = React.useState<{
    available: boolean;
    reason?: string;
    provider?: string;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SummaryState | null>(null);
  const [reply, setReply] = React.useState<{
    suggestionId: string;
    text: string;
    edited: boolean;
  } | null>(null);
  const [knowledge, setKnowledge] = React.useState<{
    suggestionId: string;
    answer: string;
    sources: Array<{ title: string; articleId: string }>;
  } | null>(null);

  React.useEffect(() => {
    if (!canUseAi) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai/status");
        const data = await res.json();
        if (!cancelled) {
          setStatus({
            available: Boolean(data.available),
            reason: data.reason,
            provider: data.provider,
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({ available: false, reason: "Unable to reach AI status" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canUseAi]);

  async function recordEvent(
    suggestionId: string,
    feature: AiFeature,
    eventType:
      | "INSERTED"
      | "EDITED"
      | "SENT"
      | "FEEDBACK_HELPFUL"
      | "FEEDBACK_NOT_HELPFUL",
  ) {
    try {
      await postJson("/api/ai/suggestion-events", {
        suggestionId,
        feature,
        eventType,
      });
    } catch {
      // non-blocking analytics
    }
  }

  function handleAiError(error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : undefined;
    if (code === "AI_UNAVAILABLE") {
      toast.error("AI is unavailable. Start Ollama or use the mock provider for tests.");
      setStatus((prev) => ({
        available: false,
        reason: "AI_UNAVAILABLE",
        provider: prev?.provider,
      }));
      return;
    }
    toast.error(error instanceof Error ? error.message : "AI request failed");
  }

  async function runSummary() {
    if (!ticketId && !conversationId) return;
    setBusy("summary");
    try {
      const data = await postJson<{
        suggestionId: string;
        feature: AiFeature;
        data: {
          summary: string;
          keyPoints?: string[];
          nextSteps?: string[];
          openQuestions?: string[];
          customerIssue?: string;
        };
      }>(
        ticketId && !conversationId
          ? "/api/ai/ticket-summary"
          : "/api/ai/conversation-summary",
        ticketId && !conversationId
          ? { ticketId }
          : conversationId
            ? { conversationId }
            : { ticketId },
      );
      const meta = [
        ...(data.data.keyPoints ?? []),
        ...(data.data.nextSteps ?? []),
        ...(data.data.openQuestions ?? []),
      ].slice(0, 4);
      setSummary({
        suggestionId: data.suggestionId,
        text: data.data.summary,
        meta,
      });
    } catch (error) {
      handleAiError(error);
    } finally {
      setBusy(null);
    }
  }

  async function runSuggestReply() {
    if (!ticketId && !conversationId) return;
    setBusy("reply");
    try {
      const data = await postJson<{
        suggestionId: string;
        data: { reply: string };
      }>("/api/ai/suggest-reply", {
        ticketId,
        conversationId,
        includeKnowledge: true,
      });
      setReply({
        suggestionId: data.suggestionId,
        text: data.data.reply,
        edited: false,
      });
    } catch (error) {
      handleAiError(error);
    } finally {
      setBusy(null);
    }
  }

  async function runKnowledge() {
    const query =
      summary?.text ||
      (ticketId ? "Help resolve this support ticket" : "Help with this conversation");
    setBusy("knowledge");
    try {
      const data = await postJson<{
        suggestionId: string;
        data: { answer: string };
        sources: Array<{ title: string; articleId: string }>;
      }>("/api/ai/knowledge-suggestions", {
        query,
        ticketId,
        conversationId,
      });
      setKnowledge({
        suggestionId: data.suggestionId,
        answer: data.data.answer,
        sources: data.sources ?? [],
      });
    } catch (error) {
      handleAiError(error);
    } finally {
      setBusy(null);
    }
  }

  async function runTone(
    tone: "professional" | "friendly" | "empathetic" | "concise",
  ) {
    if (!reply?.text) {
      toast.message("Generate a reply suggestion first.");
      return;
    }
    setBusy(`tone-${tone}`);
    try {
      const data = await postJson<{
        suggestionId: string;
        data: { rewritten: string };
      }>("/api/ai/tone-transform", {
        text: reply.text,
        tone,
        suggestionId: reply.suggestionId,
      });
      setReply({
        suggestionId: data.suggestionId,
        text: data.data.rewritten,
        edited: true,
      });
      await recordEvent(data.suggestionId, "TONE_TRANSFORM", "EDITED");
    } catch (error) {
      handleAiError(error);
    } finally {
      setBusy(null);
    }
  }

  if (!canUseAi) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI assistant
          </CardTitle>
          <CardDescription>
            AI assistance requires agent access or higher.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className={cn(compact && "pb-2")}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI assistant
            </CardTitle>
            <CardDescription>
              Drafts stay in your editor until you send them.
            </CardDescription>
          </div>
          {status ? (
            <Badge variant={status.available ? "secondary" : "outline"}>
              {status.available ? "Ready" : "Unavailable"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.available ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {status?.reason === "AI_UNAVAILABLE" || !status?.available
              ? "AI provider is unavailable. Start Ollama with llama3.2 and nomic-embed-text, or set AI_PROVIDER=mock for tests. Ticketloom will not invent answers while offline."
              : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy) || !status?.available}
            onClick={() => void runSummary()}
          >
            {busy === "summary" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Summarize
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy) || !status?.available}
            onClick={() => void runSuggestReply()}
          >
            {busy === "reply" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Suggest reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy) || !status?.available}
            onClick={() => void runKnowledge()}
          >
            {busy === "knowledge" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Knowledge
          </Button>
        </div>

        {summary ? (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </p>
              <FeedbackButtons
                onHelpful={() =>
                  void recordEvent(
                    summary.suggestionId,
                    ticketId && !conversationId
                      ? "TICKET_SUMMARY"
                      : "CONVERSATION_SUMMARY",
                    "FEEDBACK_HELPFUL",
                  )
                }
                onNotHelpful={() =>
                  void recordEvent(
                    summary.suggestionId,
                    ticketId && !conversationId
                      ? "TICKET_SUMMARY"
                      : "CONVERSATION_SUMMARY",
                    "FEEDBACK_NOT_HELPFUL",
                  )
                }
              />
            </div>
            <p className="text-sm leading-relaxed">{summary.text}</p>
            {summary.meta && summary.meta.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {summary.meta.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {knowledge ? (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Knowledge suggestions
            </p>
            <p className="text-sm leading-relaxed">{knowledge.answer}</p>
            {knowledge.sources.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {knowledge.sources.map((source) => (
                  <Badge key={source.articleId} variant="outline">
                    {source.title}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {reply ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested reply
              </p>
              <FeedbackButtons
                onHelpful={() =>
                  void recordEvent(
                    reply.suggestionId,
                    "REPLY_SUGGESTION",
                    "FEEDBACK_HELPFUL",
                  )
                }
                onNotHelpful={() =>
                  void recordEvent(
                    reply.suggestionId,
                    "REPLY_SUGGESTION",
                    "FEEDBACK_NOT_HELPFUL",
                  )
                }
              />
            </div>
            <Textarea
              value={reply.text}
              rows={compact ? 4 : 6}
              onChange={(event) => {
                setReply({
                  ...reply,
                  text: event.target.value,
                  edited: true,
                });
              }}
              onBlur={() => {
                if (reply.edited) {
                  void recordEvent(reply.suggestionId, "REPLY_SUGGESTION", "EDITED");
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              {(
                ["professional", "friendly", "empathetic", "concise"] as const
              ).map((tone) => (
                <Button
                  key={tone}
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void runTone(tone)}
                >
                  {busy === `tone-${tone}` ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {tone}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(reply.text);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </Button>
              {onInsertReply ? (
                <Button
                  size="sm"
                  onClick={() => {
                    onInsertReply(reply.text);
                    void recordEvent(
                      reply.suggestionId,
                      "REPLY_SUGGESTION",
                      "INSERTED",
                    );
                    toast.success("Inserted into composer — review before sending");
                  }}
                >
                  Insert
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeedbackButtons({
  onHelpful,
  onNotHelpful,
}: {
  onHelpful: () => void;
  onNotHelpful: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onHelpful}>
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNotHelpful}>
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
