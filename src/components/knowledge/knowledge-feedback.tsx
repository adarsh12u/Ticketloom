"use client";

import * as React from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeFeedbackProps = {
  articleId: string;
  helpfulCount: number;
  unhelpfulCount: number;
};

export function KnowledgeFeedback({
  articleId,
  helpfulCount,
  unhelpfulCount,
}: KnowledgeFeedbackProps) {
  const [pending, setPending] = React.useState(false);
  const [helpful, setHelpful] = React.useState<boolean | null>(null);
  const [comment, setComment] = React.useState("");
  const [localHelpful, setLocalHelpful] = React.useState(helpfulCount);
  const [localUnhelpful, setLocalUnhelpful] = React.useState(unhelpfulCount);
  const [submitted, setSubmitted] = React.useState(false);

  async function submit(nextHelpful: boolean) {
    setHelpful(nextHelpful);
    setPending(true);
    try {
      const response = await fetch(`/api/knowledge/${articleId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          helpful: nextHelpful,
          comment: comment.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to submit feedback.");
      }
      if (nextHelpful) {
        setLocalHelpful((count) => count + (submitted && helpful === true ? 0 : 1));
        if (submitted && helpful === false) {
          setLocalUnhelpful((count) => Math.max(0, count - 1));
        }
      } else {
        setLocalUnhelpful((count) => count + (submitted && helpful === false ? 0 : 1));
        if (submitted && helpful === true) {
          setLocalHelpful((count) => Math.max(0, count - 1));
        }
      }
      setSubmitted(true);
      toast.success("Thanks for your feedback");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit feedback.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Was this article helpful?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {localHelpful} helpful · {localUnhelpful} not helpful
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={helpful === true ? "default" : "outline"}
          disabled={pending}
          className="gap-1.5"
          onClick={() => void submit(true)}
        >
          {pending && helpful === true ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
          Yes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={helpful === false ? "default" : "outline"}
          disabled={pending}
          className="gap-1.5"
          onClick={() => void submit(false)}
        >
          {pending && helpful === false ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
          No
        </Button>
      </div>
      <Textarea
        className="mt-3"
        placeholder="Optional comment…"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        disabled={pending}
      />
    </div>
  );
}
