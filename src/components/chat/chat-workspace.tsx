"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "@/lib/utils/date";
import {
  Loader2,
  MessageSquare,
  Search,
  Send,
  BookOpen,
  Sparkles,
  UserRound,
  Ticket as TicketIcon,
} from "lucide-react";
import { toast } from "sonner";

import { KnowledgeSearchPanel } from "@/components/knowledge/knowledge-search-panel";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { emitWithAck, SOCKET_EVENTS, useChatSocket } from "@/hooks/use-chat-socket";
import { cn } from "@/lib/utils";

export type ChatConversation = {
  id: string;
  subject: string | null;
  status: string;
  customerId: string;
  ticketId: string | null;
  assignedAgentId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
  customer: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    image: string | null;
  };
  ticket: {
    id: string;
    numberKey: string;
    subject: string;
    status: string;
    priority: string;
  } | null;
  assignedAgent: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  clientMessageId: string;
  body: string;
  type: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: { id: string; name: string | null; email: string; image: string | null } | null;
  localStatus?: "sending" | "sent" | "failed";
};

type AgentOption = { id: string; name: string | null; email: string };

type ChatWorkspaceProps = {
  userId: string;
  initialConversations: ChatConversation[];
  initialConversationId?: string | null;
  agents: AgentOption[];
  canUpdate: boolean;
  canAssign: boolean;
  canUseAi?: boolean;
};

function newClientMessageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ChatWorkspace({
  userId,
  initialConversations,
  initialConversationId,
  agents,
  canUpdate,
  canAssign,
  canUseAi = false,
}: ChatWorkspaceProps) {
  const { socket, connected } = useChatSocket(true);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      return (
        item.customer.name.toLowerCase().includes(q) ||
        item.customer.email.toLowerCase().includes(q) ||
        (item.subject ?? "").toLowerCase().includes(q) ||
        (item.ticket?.numberKey ?? "").toLowerCase().includes(q) ||
        (item.lastMessagePreview ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, query]);

  const loadMessages = useCallback(async (conversationId: string, cursor?: string) => {
    setLoadingMessages(true);
    try {
      const url = new URL(
        `/api/chat/conversations/${conversationId}/messages`,
        window.location.origin,
      );
      if (cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "50");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = (await response.json()) as {
        items: ChatMessage[];
        nextCursor: string | null;
        hasMore: boolean;
      };
      setMessages((prev) => {
        const mapped = data.items.map((item) => ({
          ...item,
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date(item.createdAt).toISOString(),
          localStatus: "sent" as const,
        }));
        if (cursor) return [...mapped, ...prev];
        return mapped;
      });
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Unable to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void (async () => {
      try {
        const url = new URL(
          `/api/chat/conversations/${selectedId}/messages`,
          window.location.origin,
        );
        url.searchParams.set("limit", "50");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load messages");
        const data = (await response.json()) as {
          items: ChatMessage[];
          nextCursor: string | null;
          hasMore: boolean;
        };
        if (cancelled) return;
        setMessages(
          data.items.map((item) => ({
            ...item,
            createdAt:
              typeof item.createdAt === "string"
                ? item.createdAt
                : new Date(item.createdAt).toISOString(),
            localStatus: "sent" as const,
          })),
        );
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch {
        if (!cancelled) toast.error("Unable to load messages.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!socket || !selectedId) return;
    void emitWithAck(socket, SOCKET_EVENTS.conversationJoin, {
      conversationId: selectedId,
    });
    return () => {
      socket.emit(SOCKET_EVENTS.conversationLeave, { conversationId: selectedId });
    };
  }, [socket, selectedId, connected]);

  useEffect(() => {
    if (!socket) return;

    const onMessageNew = (payload: { message: ChatMessage }) => {
      const message = {
        ...payload.message,
        createdAt:
          typeof payload.message.createdAt === "string"
            ? payload.message.createdAt
            : new Date(payload.message.createdAt).toISOString(),
        localStatus: "sent" as const,
      };
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id || item.clientMessageId === message.clientMessageId)) {
          return prev.map((item) =>
            item.clientMessageId === message.clientMessageId || item.id === message.id
              ? { ...message, localStatus: "sent" }
              : item,
          );
        }
        if (message.conversationId !== selectedId) return prev;
        return [...prev, message];
      });
      setConversations((prev) =>
        prev.map((item) =>
          item.id === message.conversationId
            ? {
                ...item,
                lastMessageAt: message.createdAt,
                lastMessagePreview: message.body.slice(0, 280),
                unreadCount:
                  message.senderUserId === userId
                    ? item.unreadCount
                    : message.conversationId === selectedId
                      ? item.unreadCount
                      : (item.unreadCount ?? 0) + 1,
              }
            : item,
        ),
      );
      if (message.conversationId === selectedId && message.senderUserId !== userId) {
        void emitWithAck(socket, SOCKET_EVENTS.messageRead, {
          conversationId: selectedId,
          messageId: message.id,
        });
      }
    };

    const onTypingStart = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId !== selectedId || payload.userId === userId) return;
      setTypingUserIds((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId],
      );
    };
    const onTypingStop = (payload: { conversationId: string; userId: string }) => {
      setTypingUserIds((prev) => prev.filter((id) => id !== payload.userId));
    };
    const onPresence = (payload: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        if (payload.online) {
          return prev.includes(payload.userId) ? prev : [...prev, payload.userId];
        }
        return prev.filter((id) => id !== payload.userId);
      });
    };
    const onUnread = (payload: { conversationId: string; unreadCount?: number }) => {
      setConversations((prev) =>
        prev.map((item) =>
          item.id === payload.conversationId
            ? {
                ...item,
                unreadCount:
                  payload.unreadCount ??
                  (item.id === selectedId ? 0 : item.unreadCount),
              }
            : item,
        ),
      );
    };
    const onAssignment = (payload: { conversation: ChatConversation }) => {
      setConversations((prev) =>
        prev.map((item) =>
          item.id === payload.conversation.id ? { ...item, ...payload.conversation } : item,
        ),
      );
    };

    socket.on(SOCKET_EVENTS.messageNew, onMessageNew);
    socket.on(SOCKET_EVENTS.typingStart, onTypingStart);
    socket.on(SOCKET_EVENTS.typingStop, onTypingStop);
    socket.on(SOCKET_EVENTS.presenceUpdate, onPresence);
    socket.on(SOCKET_EVENTS.unreadUpdated, onUnread);
    socket.on(SOCKET_EVENTS.assignmentUpdated, onAssignment);

    return () => {
      socket.off(SOCKET_EVENTS.messageNew, onMessageNew);
      socket.off(SOCKET_EVENTS.typingStart, onTypingStart);
      socket.off(SOCKET_EVENTS.typingStop, onTypingStop);
      socket.off(SOCKET_EVENTS.presenceUpdate, onPresence);
      socket.off(SOCKET_EVENTS.unreadUpdated, onUnread);
      socket.off(SOCKET_EVENTS.assignmentUpdated, onAssignment);
    };
  }, [socket, selectedId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUserIds.length]);

  const sendMessage = async (retryClientId?: string, retryBody?: string) => {
    if (!socket || !selectedId || !canUpdate) return;
    const body = (retryBody ?? draft).trim();
    if (!body) return;
    const clientMessageId = retryClientId ?? newClientMessageId();

    if (!retryClientId) {
      setDraft("");
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${clientMessageId}`,
          conversationId: selectedId,
          senderUserId: userId,
          clientMessageId,
          body,
          type: "TEXT",
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
          localStatus: "sending",
        },
      ]);
    } else {
      setMessages((prev) =>
        prev.map((item) =>
          item.clientMessageId === clientMessageId
            ? { ...item, localStatus: "sending" }
            : item,
        ),
      );
    }

    socket.emit(SOCKET_EVENTS.typingStop, { conversationId: selectedId });

    const ack = await emitWithAck<
      { conversationId: string; body: string; clientMessageId: string },
      { message: ChatMessage; created: boolean }
    >(socket, SOCKET_EVENTS.messageSend, {
      conversationId: selectedId,
      body,
      clientMessageId,
    });

    if (!ack.ok) {
      setMessages((prev) =>
        prev.map((item) =>
          item.clientMessageId === clientMessageId
            ? { ...item, localStatus: "failed" }
            : item,
        ),
      );
      toast.error(ack.message);
      return;
    }

    setMessages((prev) =>
      prev.map((item) =>
        item.clientMessageId === clientMessageId
          ? {
              ...ack.data.message,
              createdAt:
                typeof ack.data.message.createdAt === "string"
                  ? ack.data.message.createdAt
                  : new Date(ack.data.message.createdAt).toISOString(),
              localStatus: "sent",
            }
          : item,
      ),
    );
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!socket || !selectedId || !canUpdate) return;
    socket.emit(SOCKET_EVENTS.typingStart, { conversationId: selectedId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.typingStop, { conversationId: selectedId });
    }, 1200);
  };

  const assign = (assigneeId: string | null) => {
    if (!socket || !selectedId || !canAssign) return;
    startTransition(async () => {
      const ack = await emitWithAck(socket, SOCKET_EVENTS.assignmentUpdated, {
        conversationId: selectedId,
        assigneeId,
      });
      if (!ack.ok) toast.error(ack.message);
    });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] overflow-hidden rounded-lg border bg-card shadow-sm">
      <aside className="flex w-full max-w-[320px] flex-col border-r md:w-[320px]">
        <div className="border-b p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Live" : "Offline"}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search customers, tickets…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No conversations yet.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "w-full px-3 py-3 text-left transition-colors hover:bg-muted/50",
                        active && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.customer.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.lastMessagePreview || item.subject || "No messages yet"}
                          </p>
                        </div>
                        {(item.unreadCount ?? 0) > 0 ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {item.status}
                        </Badge>
                        {item.ticket ? <span>{item.ticket.numberKey}</span> : null}
                        {item.lastMessageAt ? (
                          <span>
                            {formatDistanceToNow(new Date(item.lastMessageAt))}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected.customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.subject || "Support conversation"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      Knowledge
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Knowledge search</SheetTitle>
                      <SheetDescription>
                        Look up approved articles while helping this customer.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                      <KnowledgeSearchPanel
                        query={selected.subject ?? selected.customer.name}
                        compact
                        className="border-0 p-0 shadow-none"
                      />
                    </div>
                  </SheetContent>
                </Sheet>
                {selected.ticket ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/tickets/${selected.ticket.id}`}>
                      {selected.ticket.numberKey}
                    </Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/customers/${selected.customerId}`}>Customer</Link>
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {hasMore ? (
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loadingMessages}
                    onClick={() => selectedId && nextCursor && loadMessages(selectedId, nextCursor)}
                  >
                    {loadingMessages ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load older"}
                  </Button>
                </div>
              ) : null}
              {messages.map((message) => {
                const mine = message.senderUserId === userId;
                return (
                  <div
                    key={message.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                        message.localStatus === "failed" && "ring-1 ring-destructive",
                      )}
                    >
                      {message.deletedAt ? (
                        <p className="italic opacity-70">Message deleted</p>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      )}
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-2 text-[10px]",
                          mine ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        <span>
                          {message.sender?.name || message.sender?.email || "System"}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(message.createdAt))}
                        </span>
                        {message.localStatus === "sending" ? <span>Sending…</span> : null}
                        {message.localStatus === "failed" ? (
                          <button
                            type="button"
                            className="underline"
                            onClick={() =>
                              void sendMessage(message.clientMessageId, message.body)
                            }
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingUserIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">Someone is typing…</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t p-3 space-y-2">
              {canUseAi && selectedId ? (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI assist
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>AI assistant</SheetTitle>
                      <SheetDescription>
                        Summarize, suggest a reply, or adjust tone. Nothing is sent automatically.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                      <AiAssistantPanel
                        conversationId={selectedId}
                        canUseAi={canUseAi}
                        compact
                        className="border-0 p-0 shadow-none"
                        onInsertReply={(text) => setDraft(text)}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              ) : null}
              <div className="flex gap-2">
                <Textarea
                  value={draft}
                  disabled={!canUpdate || !connected}
                  placeholder={
                    canUpdate
                      ? "Write a reply… (Enter to send, Shift+Enter for newline)"
                      : "You have read-only access"
                  }
                  className="min-h-[72px] resize-none"
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <Button
                  className="self-end"
                  disabled={!canUpdate || !connected || !draft.trim() || pending}
                  onClick={() => void sendMessage()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Select a conversation to begin.</p>
          </div>
        )}
      </section>

      <aside className="hidden w-[280px] flex-col border-l lg:flex">
        {selected ? (
          <ScrollArea className="flex-1 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer
            </h3>
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-medium">{selected.customer.name}</p>
              <p className="text-muted-foreground">{selected.customer.email}</p>
              {selected.customer.company ? (
                <p className="text-muted-foreground">{selected.customer.company}</p>
              ) : null}
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href={`/customers/${selected.customerId}`}>
                  <UserRound className="mr-1 h-3.5 w-3.5" />
                  Open profile
                </Link>
              </Button>
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket
            </h3>
            {selected.ticket ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-medium">{selected.ticket.numberKey}</p>
                <p className="text-muted-foreground">{selected.ticket.subject}</p>
                <Badge variant="outline">{selected.ticket.status}</Badge>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href={`/tickets/${selected.ticket.id}`}>
                    <TicketIcon className="mr-1 h-3.5 w-3.5" />
                    Open ticket
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No linked ticket.</p>
            )}

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assignment
            </h3>
            <div className="mt-2 space-y-2">
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                disabled={!canAssign}
                value={selected.assignedAgentId ?? ""}
                onChange={(event) =>
                  assign(event.target.value ? event.target.value : null)
                }
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.email}
                    {onlineUserIds.includes(agent.id) ? " ●" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Status: {selected.status}
              </p>
            </div>
          </ScrollArea>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">Context panel</div>
        )}
      </aside>
    </div>
  );
}
