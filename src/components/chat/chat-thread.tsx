"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, Check, CheckCheck, Image as ImageIcon, Loader2, Send } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { useChatStream, type StreamedMessage } from "@/hooks/useChatStream";
import {
  loadOlderMessagesAction,
  markConversationReadAction,
  sendMessageAction,
} from "@/app/[locale]/messages/[conversationId]/actions";
import { uploadFile } from "@/lib/upload-client";
import { MESSAGES_READ_EVENT } from "@/components/layout/unread-messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatThreadProps {
  conversationId: string;
  actorId: string;
  counterpartyName: string;
  counterpartyAvatarUrl: string | null;
  initialMessages: StreamedMessage[];
  initialNextCursor: number | null;
}

export function ChatThread({
  conversationId,
  actorId,
  counterpartyName,
  counterpartyAvatarUrl,
  initialMessages,
  initialNextCursor,
}: ChatThreadProps) {
  const t = useTranslations("chat");
  const tErrors = useTranslations("errors");
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendMessage(message: StreamedMessage) {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }

  useChatStream(conversationId, (message) => {
    appendMessage(message);
    if (message.senderId !== actorId) {
      void markConversationReadAction(conversationId);
    }
  });

  useEffect(() => {
    // Opening the thread reads its messages; tell the header badge to recount.
    void markConversationReadAction(conversationId).then(() =>
      window.dispatchEvent(new Event(MESSAGES_READ_EVENT)),
    );
  }, [conversationId]);

  // Scroll only the message list (not the whole page) to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function handleLoadOlder() {
    if (nextCursor === null) return;
    setLoadingOlder(true);
    const result = await loadOlderMessagesAction(conversationId, nextCursor);
    setLoadingOlder(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [
      ...result.data.items.map((item) => ({
        id: item.id,
        conversationId: item.conversationId,
        senderId: item.senderId,
        body: item.body,
        imageUrl: item.imageUrl,
        readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
        createdAt: new Date(item.createdAt).toISOString(),
      })),
      ...prev,
    ]);
    setNextCursor(result.data.nextCursor);
  }

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendMessageAction(conversationId, { body: body.trim() });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    appendMessage({
      id: result.data.id,
      conversationId: result.data.conversationId,
      senderId: result.data.senderId,
      body: result.data.body,
      imageUrl: null,
      readAt: null,
      createdAt: new Date(result.data.createdAt).toISOString(),
    });
    setBody("");
  }

  async function handleAttachImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const key = await uploadFile(file, "chat", conversationId);
      const result = await sendMessageAction(conversationId, { imageKey: key });
      if (!result.ok) throw new Error(result.error);
      appendMessage({
        id: result.data.id,
        conversationId: result.data.conversationId,
        senderId: result.data.senderId,
        body: result.data.body,
        imageUrl: URL.createObjectURL(file),
        readAt: null,
        createdAt: new Date(result.data.createdAt).toISOString(),
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "UPLOAD_FAILED"
          ? err.message
          : tErrors("UPLOAD_FAILED"),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card className="h-[min(40rem,calc(100dvh-8rem))] gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b px-3 py-2.5">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/messages" aria-label={t("inboxTitle")}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <Avatar className="size-10 shrink-0">
            <AvatarImage
              src={counterpartyAvatarUrl ?? undefined}
              alt={counterpartyName}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials(counterpartyName)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate font-semibold">{counterpartyName}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-muted/30 p-4">
          {nextCursor !== null ? (
            <Button variant="ghost" size="sm" disabled={loadingOlder} onClick={handleLoadOlder}>
              {loadingOlder ? <Loader2 className="animate-spin" /> : t("loadOlder")}
            </Button>
          ) : null}

          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === actorId}
              imageAlt={t("imageAlt")}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t bg-card p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAttachImage}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("sendImage")}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon className="size-4" />}
          </Button>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder={t("placeholder")}
            className="max-h-32 min-h-10 flex-1 resize-none"
          />
          <Button
            type="button"
            size="icon"
            disabled={sending || !body.trim()}
            onClick={handleSend}
            aria-label={t("send")}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>

        {error ? <p className="bg-card px-3 pb-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </main>
  );
}

/** Send time (plus ✓ sent / ✓✓ read on your own messages), shown in the bubble's corner. */
function MessageMeta({ message, isOwn }: { message: StreamedMessage; isOwn: boolean }) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const read = message.readAt !== null;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] leading-none whitespace-nowrap",
        isOwn ? "text-primary-foreground/75" : "text-muted-foreground",
      )}
    >
      <time dateTime={message.createdAt}>
        {format.dateTime(new Date(message.createdAt), { hour: "2-digit", minute: "2-digit" })}
      </time>
      {isOwn ? (
        read ? (
          <CheckCheck className="size-3.5" aria-label={t("statusRead")} />
        ) : (
          <Check className="size-3.5" aria-label={t("statusSent")} />
        )
      ) : null}
    </span>
  );
}

function ChatBubble({
  message,
  isOwn,
  imageAlt,
}: {
  message: StreamedMessage;
  isOwn: boolean;
  imageAlt: string;
}) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border bg-card",
        )}
      >
        {message.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob previews + signed URLs aren't worth remotePatterns config (see PLAN.md)
          <img
            src={message.imageUrl}
            alt={imageAlt}
            className="mb-1 max-h-60 rounded object-cover"
          />
        ) : null}
        {message.body ? (
          <>
            {/* The invisible spacer reserves room on the last line, so the time sits
                beside short text and drops below long text, like WhatsApp/LINE. */}
            <p className="whitespace-pre-wrap">
              {message.body}
              <span aria-hidden className={cn("inline-block", isOwn ? "w-16" : "w-11")} />
            </p>
            <span className="absolute right-2.5 bottom-1.5">
              <MessageMeta message={message} isOwn={isOwn} />
            </span>
          </>
        ) : (
          <div className="flex justify-end">
            <MessageMeta message={message} isOwn={isOwn} />
          </div>
        )}
      </div>
    </div>
  );
}
