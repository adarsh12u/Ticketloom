"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KNOWLEDGE_VISIBILITIES } from "@/lib/validations/knowledge";

export type KnowledgeEditorCategory = {
  id: string;
  name: string;
};

export type KnowledgeEditorTag = {
  id: string;
  name: string;
};

export type KnowledgeEditorArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string;
  categoryId: string | null;
  visibility: string;
  tags: Array<{ id: string; name: string }>;
};

type KnowledgeArticleEditorProps = {
  mode: "create" | "edit";
  categories: KnowledgeEditorCategory[];
  tags: KnowledgeEditorTag[];
  article?: KnowledgeEditorArticle;
};

export function KnowledgeArticleEditor({
  mode,
  categories,
  tags,
  article,
}: KnowledgeArticleEditorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(article?.title ?? "");
  const [excerpt, setExcerpt] = React.useState(article?.excerpt ?? "");
  const [bodyMarkdown, setBodyMarkdown] = React.useState(
    article?.bodyMarkdown ?? "",
  );
  const [categoryId, setCategoryId] = React.useState(article?.categoryId ?? "");
  const [visibility, setVisibility] = React.useState(
    article?.visibility ?? "INTERNAL",
  );
  const [selectedTags, setSelectedTags] = React.useState<string[]>(
    article?.tags.map((tag) => tag.id) ?? [],
  );
  const [tagNames, setTagNames] = React.useState("");
  const [changeSummary, setChangeSummary] = React.useState("");

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        bodyMarkdown,
        categoryId: categoryId || null,
        visibility,
        tagIds: selectedTags,
        tagNames: tagNames
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        changeSummary: changeSummary.trim() || null,
      };

      const response = await fetch(
        mode === "create" ? "/api/knowledge" : `/api/knowledge/${article!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        article?: { id: string };
      };
      if (!response.ok || !data.article) {
        throw new Error(data.error ?? "Unable to save article.");
      }
      toast.success(mode === "create" ? "Article created" : "Article updated");
      router.push(`/knowledge/${data.article.id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save article.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Create article" : "Edit article"}
        </CardTitle>
        <CardDescription>
          Write in Markdown. Content is sanitized on publish and display.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={3}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Short summary shown in search results"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyMarkdown">Body (Markdown)</Label>
            <Textarea
              id="bodyMarkdown"
              value={bodyMarkdown}
              onChange={(event) => setBodyMarkdown(event.target.value)}
              required
              rows={16}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                {KNOWLEDGE_VISIBILITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={
                      selected
                        ? "rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                        : "rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags yet.</p>
              ) : null}
            </div>
            <Input
              value={tagNames}
              onChange={(event) => setTagNames(event.target.value)}
              placeholder="Add new tags, comma-separated"
            />
          </div>

          {mode === "edit" ? (
            <div className="space-y-2">
              <Label htmlFor="changeSummary">Change summary</Label>
              <Input
                id="changeSummary"
                value={changeSummary}
                onChange={(event) => setChangeSummary(event.target.value)}
                maxLength={240}
                placeholder="What changed in this revision?"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? "Create article" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
