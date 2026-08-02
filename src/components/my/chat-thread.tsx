"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};

const POLL_MS = 8000;

/**
 * חוט השיחה. הודעות חדשות נמשכות בפולינג קצר — פשוט ואמין
 * יותר מ-WebSocket בפריסה serverless, ומספיק מהיר לשיחת מו״מ.
 */
export function ChatThread({
  conversationId,
  currentUserId,
  otherName,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  otherName: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  React.useEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  // משיכת הודעות חדשות; עוצר כשהלשונית מוסתרת כדי לא לבזבז בקשות
  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const after = messages[messages.length - 1]?.createdAt ?? "";
        const res = await fetch(
          `/api/messages/${conversationId}?after=${encodeURIComponent(after)}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (!data.messages.length) return;

        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const added = data.messages.filter((m) => !seen.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch {
        // כשל רשת זמני — הפולינג הבא ינסה שוב
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conversationId, messages]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "שליחת ההודעה נכשלה");
        setDraft(body);
        return;
      }
      setMessages((prev) => [...prev, data.message as ChatMessage]);
    } catch {
      toast.error("שליחת ההודעה נכשלה");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  // כותרת תאריך מוצגת פעם אחת לכל יום
  let lastDay = "";

  return (
    <>
      <div
        className="flex-1 space-y-2 overflow-y-auto border-x border-border bg-muted/20 p-3"
        role="log"
        aria-live="polite"
        aria-label={`שיחה עם ${otherName}`}
      >
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const day = new Date(m.createdAt).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;

          return (
            <React.Fragment key={m.id}>
              {showDay ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {formatDate(m.createdAt)}
                </p>
              ) : null}
              <div className={cn("flex", mine ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%]",
                    mine
                      ? "rounded-ss-sm bg-primary text-primary-foreground"
                      : "rounded-se-sm bg-card text-card-foreground",
                  )}
                >
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <time
                    dateTime={m.createdAt}
                    className={cn(
                      "num mt-0.5 block text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.createdAt).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-x border-border bg-card p-2.5"
      >
        <label htmlFor="chat-input" className="sr-only">
          הודעה ל{otherName}
        </label>
        <Textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter שולח, Shift+Enter יורד שורה
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="כתבו הודעה…"
          rows={1}
          maxLength={2000}
          className="min-h-10 resize-none"
        />
        <Button type="submit" size="icon" loading={sending} disabled={!draft.trim()} aria-label="שליחה">
          <Send aria-hidden />
        </Button>
      </form>
    </>
  );
}
