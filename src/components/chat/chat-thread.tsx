"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Send } from "lucide-react";
import { useChatStream, type StreamedMessage } from "@/hooks/useChatStream";
import {
  loadOlderMessagesAction,
  markConversationReadAction,
  sendMessageAction,
} from "@/app/[locale]/messages/[conversationId]/actions";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatThreadProps {
  conversationId: string;
  actorId: string;
  counterpartyName: string;
  initialMessages: StreamedMessage[];
  initialNextCursor: number | null;
}

export function ChatThread({
  conversationId,
  actorId,
  counterpartyName,
  initialMessages,
  initialNextCursor,
}: ChatThreadProps) {
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
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center border-b p-3 font-medium">{counterpartyName}</div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {nextCursor !== null ? (
          <Button variant="ghost" size="sm" disabled={loadingOlder} onClick={handleLoadOlder}>
            {loadingOlder ? <Loader2 className="animate-spin" /> : "โหลดข้อความเก่า"}
          </Button>
        ) : null}

        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} isOwn={message.senderId === actorId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t p-3">
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
          aria-label="ส่งรูปภาพ"
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
          placeholder="พิมพ์ข้อความ..."
          className="min-h-12 flex-1 resize-none"
        />
        <Button
          type="button"
          size="icon"
          disabled={sending || !body.trim()}
          onClick={handleSend}
          aria-label="ส่งข้อความ"
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>

      {error ? <p className="text-destructive px-3 pb-2 text-sm">{error}</p> : null}
    </div>
  );
}

function ChatBubble({ message, isOwn }: { message: StreamedMessage; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {message.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob previews + signed URLs aren't worth remotePatterns config (see PLAN.md)
          <img
            src={message.imageUrl}
            alt="รูปภาพที่ส่งในแชต"
            className="mb-1 max-h-60 rounded object-cover"
          />
        ) : null}
        {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
      </div>
    </div>
  );
}
