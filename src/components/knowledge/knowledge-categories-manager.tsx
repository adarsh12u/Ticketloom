"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type KnowledgeCategoryItem = {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  sortOrder: number;
  status: string;
};

type KnowledgeCategoriesManagerProps = {
  items: KnowledgeCategoryItem[];
};

export function KnowledgeCategoriesManager({
  items,
}: KnowledgeCategoriesManagerProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<KnowledgeCategoryItem | null>(
    null,
  );
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [parentCategoryId, setParentCategoryId] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("0");

  function openCreate() {
    setName("");
    setDescription("");
    setParentCategoryId("");
    setSortOrder("0");
    setCreateOpen(true);
  }

  function openEdit(item: KnowledgeCategoryItem) {
    setEditItem(item);
    setName(item.name);
    setDescription(item.description ?? "");
    setParentCategoryId(item.parentCategoryId ?? "");
    setSortOrder(String(item.sortOrder));
  }

  async function createCategory() {
    setPending(true);
    try {
      const response = await fetch("/api/knowledge/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          parentCategoryId: parentCategoryId || null,
          sortOrder: Number(sortOrder) || 0,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        category?: KnowledgeCategoryItem;
      };
      if (!response.ok || !data.category) {
        throw new Error(data.error ?? "Unable to create category.");
      }
      toast.success("Category created");
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create category.",
      );
    } finally {
      setPending(false);
    }
  }

  async function updateCategory(status?: string) {
    if (!editItem) return;
    setPending(true);
    try {
      const response = await fetch(`/api/knowledge/categories/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          parentCategoryId: parentCategoryId || null,
          sortOrder: Number(sortOrder) || 0,
          ...(status ? { status } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update category.");
      }
      toast.success("Category updated");
      setEditItem(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update category.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/knowledge">Knowledge Base</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Categories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize articles for agents and search.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <ul className="divide-y">
          {items.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No categories yet.
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge
                      variant={item.status === "ACTIVE" ? "success" : "secondary"}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sort {item.sortOrder}
                    {item.parentCategoryId
                      ? ` · Parent ${items.find((c) => c.id === item.parentCategoryId)?.name ?? item.parentCategoryId}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(item)}
                >
                  Edit
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>
              Categories help agents browse and filter knowledge articles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat-parent">Parent</Label>
                <select
                  id="cat-parent"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={parentCategoryId}
                  onChange={(event) => setParentCategoryId(event.target.value)}
                >
                  <option value="">None</option>
                  {items
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || name.trim().length < 2}
              onClick={() => void createCategory()}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editItem)}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>Update name, parent, or archive status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-parent">Parent</Label>
                <select
                  id="edit-parent"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={parentCategoryId}
                  onChange={(event) => setParentCategoryId(event.target.value)}
                >
                  <option value="">None</option>
                  {items
                    .filter(
                      (item) =>
                        item.status === "ACTIVE" && item.id !== editItem?.id,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sort">Sort order</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editItem?.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void updateCategory("ARCHIVED")}
              >
                Archive
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={pending}
                onClick={() => void updateCategory("ACTIVE")}
              >
                <RotateCcw className="h-4 w-4" />
                Reactivate
              </Button>
            )}
            <Button
              type="button"
              disabled={pending || name.trim().length < 2}
              onClick={() => void updateCategory()}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
